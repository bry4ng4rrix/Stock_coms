import json
from urllib.parse import parse_qs
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken

User = get_user_model()

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # 1. Parse token from query string
        query_string = self.scope.get("query_string", b"").decode("utf-8")
        query_params = parse_qs(query_string)
        token_list = query_params.get("token")
        
        self.user = None
        if token_list:
            token = token_list[0]
            self.user = await self.get_user_from_token(token)
            
        if not self.user or self.user.is_anonymous:
            # Reject connection if not authenticated
            await self.close()
            return
            
        user_admin = await self.get_user_admin_async(self.user)
        if not user_admin:
            await self.close()
            return

        # 2. Get room name: could be 'general' or 'dm_<user1_id>_<user2_id>'
        room_list = query_params.get("room")
        raw_room = room_list[0] if room_list else "general"

        recipient_id_list = query_params.get("recipient_id")
        if recipient_id_list:
            try:
                recipient_id = int(recipient_id_list[0])
                self.recipient = await self.get_user_by_id(recipient_id)
                if not self.recipient:
                    await self.close()
                    return
                # Verify that the recipient belongs to the same admin organization
                recipient_admin = await self.get_user_admin_async(self.recipient)
                if not recipient_admin or recipient_admin.id != user_admin.id:
                    await self.close()
                    return
                # Create a deterministic room name for the DM
                user_ids = sorted([self.user.id, recipient_id])
                self.room_name = f"dm_{user_ids[0]}_{user_ids[1]}"
            except Exception:
                await self.close()
                return
        else:
            self.recipient = None
            if raw_room == "general":
                self.room_name = f"general_{user_admin.id}"
            else:
                self.room_name = raw_room

        self.room_group_name = f"chat_{self.room_name}"
        
        # 3. Join the room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()
        
    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
            
    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return
            
        content = data.get("content")
        if not content:
            return
            
        # Save message to database
        saved_msg = await self.save_message(self.user, self.recipient, self.room_name, content)
        
        # Broadcast to room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "chat_message",
                "message": saved_msg
            }
        )
        
    async def chat_message(self, event):
        # Send message to WebSocket
        await self.send(text_data=json.dumps(event["message"]))
        
    @database_sync_to_async
    def get_user_from_token(self, token_str):
        try:
            access_token = AccessToken(token_str)
            user_id = access_token["user_id"]
            return User.objects.get(id=user_id)
        except Exception:
            return None
            
    @database_sync_to_async
    def get_user_by_id(self, user_id):
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return None

    @database_sync_to_async
    def get_user_admin_async(self, user):
        if not user or user.is_anonymous:
            return None
        if user.role == "admin":
            return user
        elif user.role == "magasin":
            try:
                return user.magasin_profile.admin
            except Exception:
                return None
        elif user.role == "employer":
            try:
                ep = user.employer_profile
                if ep.admin:
                    return ep.admin
                if ep.magasin:
                    return ep.magasin.admin
            except Exception:
                return None
        return None
            
    @database_sync_to_async
    def save_message(self, sender, recipient, room_name, content):
        from users.models import ChatMessage
        msg = ChatMessage.objects.create(
            sender=sender,
            recipient=recipient,
            room_name=room_name,
            content=content
        )
        return {
            "id": msg.id,
            "sender": sender.id,
            "sender_name": sender.full_name,
            "sender_email": sender.email,
            "sender_role": sender.role,
            "recipient": recipient.id if recipient else None,
            "recipient_name": recipient.full_name if recipient else None,
            "recipient_email": recipient.email if recipient else None,
            "room_name": room_name,
            "content": content,
            "timestamp": msg.timestamp.isoformat()
        }


class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # 1. Parse token from query string
        query_string = self.scope.get("query_string", b"").decode("utf-8")
        query_params = parse_qs(query_string)
        token_list = query_params.get("token")
        
        self.user = None
        if token_list:
            token = token_list[0]
            self.user = await self.get_user_from_token(token)
            
        if not self.user or self.user.is_anonymous:
            await self.close()
            return
            
        self.groups_joined = []
        
        # 2. Join groups based on role
        if self.user.role == "admin":
            group_name = f"notifications_admin_{self.user.id}"
            await self.channel_layer.group_add(group_name, self.channel_name)
            self.groups_joined.append(group_name)
        else:
            magasin_id = await self.get_user_magasin_id(self.user)
            if magasin_id:
                group_name = f"notifications_magasin_{magasin_id}"
                await self.channel_layer.group_add(group_name, self.channel_name)
                self.groups_joined.append(group_name)
                
        # 3. Always join personal group for direct notifications
        personal_group = f"notifications_user_{self.user.id}"
        await self.channel_layer.group_add(personal_group, self.channel_name)
        self.groups_joined.append(personal_group)
                
        await self.accept()
        
    async def disconnect(self, close_code):
        for group_name in self.groups_joined:
            await self.channel_layer.group_discard(group_name, self.channel_name)
            
    async def send_notification(self, event):
        # Send notification to WebSocket
        await self.send(text_data=json.dumps(event["notification"]))
        
    @database_sync_to_async
    def get_user_from_token(self, token_str):
        try:
            access_token = AccessToken(token_str)
            user_id = access_token["user_id"]
            return User.objects.get(id=user_id)
        except Exception:
            return None

    @database_sync_to_async
    def get_user_magasin_id(self, user):
        if user.role == "magasin":
            try:
                return user.magasin_profile.id
            except Exception:
                return None
        elif user.role == "employer":
            try:
                return user.employer_profile.magasin.id
            except Exception:
                return None
        return None


class DataSyncConsumer(AsyncWebsocketConsumer):
    """Broadcasts real-time updates for products, sales, movements and stats."""

    async def connect(self):
        query_string = self.scope.get("query_string", b"").decode("utf-8")
        query_params = parse_qs(query_string)
        token_list = query_params.get("token")

        self.user = None
        if token_list:
            self.user = await self.get_user_from_token(token_list[0])

        if not self.user or self.user.is_anonymous:
            await self.close()
            return

        self.groups_joined = []

        if self.user.role == "admin":
            group_name = f"data_admin_{self.user.id}"
            await self.channel_layer.group_add(group_name, self.channel_name)
            self.groups_joined.append(group_name)
        else:
            magasin_id = await self.get_user_magasin_id(self.user)
            if magasin_id:
                group_name = f"data_magasin_{magasin_id}"
                await self.channel_layer.group_add(group_name, self.channel_name)
                self.groups_joined.append(group_name)

        await self.accept()

    async def disconnect(self, close_code):
        for group_name in self.groups_joined:
            await self.channel_layer.group_discard(group_name, self.channel_name)

    async def data_update(self, event):
        await self.send(text_data=json.dumps(event["payload"]))

    @database_sync_to_async
    def get_user_from_token(self, token_str):
        try:
            access_token = AccessToken(token_str)
            user_id = access_token["user_id"]
            return User.objects.get(id=user_id)
        except Exception:
            return None

    @database_sync_to_async
    def get_user_magasin_id(self, user):
        if user.role == "magasin":
            try:
                return user.magasin_profile.id
            except Exception:
                return None
        elif user.role == "employer":
            try:
                return user.employer_profile.magasin.id
            except Exception:
                return None
        return None

