from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Sale, Product, CustomUser, Notification, EmployerProfile, ChatMessage


@receiver(post_save, sender=Sale)
def sale_created(sender, instance: Sale, created, **kwargs):
    if not created:
        return
    try:
        msg = f"Vente: {instance.product.name} x{instance.quantity} — {instance.total_price}"
        Notification.objects.create(notif_type="sale", message=msg, magasin=instance.magasin, sale=instance)
    except Exception:
        pass


@receiver(post_save, sender=Product)
def product_created(sender, instance: Product, created, **kwargs):
    if not created:
        return
    try:
        msg = f"Nouveau produit: {instance.name} ({instance.reference})"
        Notification.objects.create(notif_type="product", message=msg, magasin=instance.magasin, product=instance)
    except Exception:
        pass


@receiver(post_save, sender=CustomUser)
def user_created(sender, instance: CustomUser, created, **kwargs):
    if not created:
        return
    try:
        msg = f"Nouvel utilisateur: {instance.full_name} ({instance.email}) — rôle: {instance.role}"
        magasin = None
        # try to find magasin for employer
        if instance.role == 'employer':
            try:
                emp = EmployerProfile.objects.filter(user=instance).first()
                if emp:
                    magasin = emp.magasin
            except Exception:
                magasin = None
        Notification.objects.create(notif_type="user", message=msg, magasin=magasin, user=instance)
    except Exception:
        pass


@receiver(post_save, sender=Notification)
def notification_created_broadcast(sender, instance: Notification, created, **kwargs):
    if not created:
        return
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        channel_layer = get_channel_layer()
        if not channel_layer:
            return
            
        notif_data = {
            "id": instance.id,
            "notif_type": instance.notif_type,
            "message": instance.message,
            "magasin": instance.magasin.id if instance.magasin else None,
            "magasin_name": instance.magasin.shop_name if instance.magasin else None,
            "is_read": instance.is_read,
            "created_at": instance.created_at.isoformat()
        }
        
        # Broadcast to admins
        async_to_sync(channel_layer.group_send)(
            "notifications_admin",
            {
                "type": "send_notification",
                "notification": notif_data
            }
        )
        
        # Broadcast to specific magasin group if applicable
        if instance.magasin:
            async_to_sync(channel_layer.group_send)(
                f"notifications_magasin_{instance.magasin.id}",
                {
                    "type": "send_notification",
                    "notification": notif_data
                }
            )
            
        # Broadcast to specific user group if targeted
        if instance.user:
            async_to_sync(channel_layer.group_send)(
                f"notifications_user_{instance.user.id}",
                {
                    "type": "send_notification",
                    "notification": notif_data
                }
            )
    except Exception as e:
        print("Error broadcasting notification:", e)


@receiver(post_save, sender=ChatMessage)
def chat_message_created(sender, instance: ChatMessage, created, **kwargs):
    if not created:
        return
    try:
        sender_name = instance.sender.full_name or instance.sender.username
        
        if instance.recipient:
            # Direct Message: targeted notification
            Notification.objects.create(
                notif_type="chat",
                message=f"Message privé de {sender_name} : {instance.content[:60]}",
                user=instance.recipient
            )
        else:
            # General Message: targeted to sender's magasin
            magasin = None
            if instance.sender.role == 'magasin':
                try:
                    magasin = instance.sender.magasin_profile
                except Exception:
                    pass
            elif instance.sender.role == 'employer':
                try:
                    magasin = instance.sender.employer_profile.magasin
                except Exception:
                    pass
            
            Notification.objects.create(
                notif_type="chat",
                message=f"Message de {sender_name} dans Général : {instance.content[:60]}",
                magasin=magasin
            )
    except Exception as e:
        print("Error creating chat notification:", e)


