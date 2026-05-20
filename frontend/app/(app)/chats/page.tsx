'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Send, 
  MessageCircle, 
  User as UserIcon, 
  Shield, 
  Building2, 
  Loader2,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  store_id: string | null;
  stores?: {
    name: string;
  };
}

export default function ChatsPage() {
  const supabase = createClient();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [contacts, setContacts] = useState<UserProfile[]>([]);
  const [selectedContact, setSelectedContact] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Initial Load: Current User
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) setCurrentUser(profile);
    };

    fetchUser();
  }, []);

  // 2. Fetch Contacts based on Role
  useEffect(() => {
    if (!currentUser) return;

    const fetchContacts = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('users')
          .select('*, stores(name)')
          .neq('id', currentUser.id);

        if (currentUser.role === 'superadmin') {
          // Superadmin can see all Admins
          query = query.eq('role', 'admin');
        } else if (currentUser.role === 'admin') {
          // Admin can see Superadmins and their own store's staff
          query = query.or(`role.eq.superadmin,store_id.eq.${currentUser.store_id}`);
        } else {
          // Staff can see their Admin
          query = query.eq('store_id', currentUser.store_id).eq('role', 'admin');
        }

        const { data, error } = await query;
        if (error) throw error;
        setContacts(data || []);
      } catch (err) {
        console.error('Error fetching contacts:', err);
        toast.error('Erreur de chargement des contacts');
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, [currentUser]);

  // 3. Fetch Messages when contact selected
  useEffect(() => {
    if (!currentUser || !selectedContact) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      setLoadingMessages(true);
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedContact.id}),and(sender_id.eq.${selectedContact.id},receiver_id.eq.${currentUser.id})`)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setMessages(data || []);
        
        // Mark as read
        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('sender_id', selectedContact.id)
          .eq('receiver_id', currentUser.id)
          .eq('is_read', false);

      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        setLoadingMessages(false);
        scrollToBottom();
      }
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`chat:${currentUser.id}:${selectedContact.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${currentUser.id}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          if (msg.sender_id === selectedContact.id) {
            setMessages((prev) => [...prev, msg]);
            scrollToBottom();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedContact, currentUser]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedContact || !newMessage.trim() || sending) return;

    setSending(true);
    const content = newMessage.trim();
    setNewMessage('');

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUser.id,
          receiver_id: selectedContact.id,
          content: content,
        })
        .select()
        .single();

      if (error) throw error;
      setMessages((prev) => [...prev, data]);
      scrollToBottom();
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Erreur d\'envoi');
      setNewMessage(content);
    } finally {
      setSending(false);
    }
  };

  const filteredContacts = contacts.filter(c => 
    c.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'superadmin': return <Badge className="bg-purple-600">Superadmin</Badge>;
      case 'admin': return <Badge className="bg-blue-600">Admin</Badge>;
      default: return <Badge variant="secondary" className="capitalize">{role}</Badge>;
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] gap-4 p-4 overflow-hidden">
      {/* Sidebar - Contacts */}
      <Card className="w-80 flex flex-col overflow-hidden border-none shadow-xl bg-slate-50/50 backdrop-blur-sm">
        <CardHeader className="p-4 space-y-4">
          <CardTitle className="text-xl flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-blue-600" />
            Messages
          </CardTitle>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              className="pl-8 bg-white/50 border-none shadow-inner"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                  <div className="h-10 w-10 rounded-full bg-slate-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-24 bg-slate-200 rounded" />
                    <div className="h-2 w-16 bg-slate-200 rounded" />
                  </div>
                </div>
              ))
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <UserIcon className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Aucun contact trouvé</p>
              </div>
            ) : (
              filteredContacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => setSelectedContact(contact)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group",
                    selectedContact?.id === contact.id 
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-200 translate-x-1" 
                      : "hover:bg-white hover:shadow-md"
                  )}
                >
                  <Avatar className="h-10 w-10 border-2 border-transparent group-hover:border-blue-200 transition-colors">
                    <AvatarFallback className={cn(
                      selectedContact?.id === contact.id ? "bg-blue-500 text-white" : "bg-blue-100 text-blue-600"
                    )}>
                      {getInitials(contact.full_name || contact.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-semibold text-sm truncate flex items-center gap-1">
                      {contact.full_name || contact.email.split('@')[0]}
                      {contact.role === 'superadmin' && <Shield className="h-3 w-3" />}
                    </div>
                    <div className={cn(
                      "text-xs truncate",
                      selectedContact?.id === contact.id ? "text-blue-100" : "text-muted-foreground"
                    )}>
                      {contact.stores?.name || contact.role}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Main Chat Area */}
      <Card className="flex-1 flex flex-col overflow-hidden border-none shadow-xl bg-white/80 backdrop-blur-sm">
        {selectedContact ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border-2 border-blue-100">
                  <AvatarFallback className="bg-blue-50 text-blue-600">
                    {getInitials(selectedContact.full_name || selectedContact.email)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-bold text-sm flex items-center gap-2">
                    {selectedContact.full_name}
                    {getRoleBadge(selectedContact.role)}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {selectedContact.stores?.name || "Tous les magasins"}
                  </div>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-6 bg-slate-50/30">
              <div className="space-y-4">
                {loadingMessages ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <MessageCircle className="h-8 w-8 text-blue-200" />
                    </div>
                    <p className="text-muted-foreground">Commencez la conversation avec {selectedContact.full_name}</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isMe = msg.sender_id === currentUser?.id;
                    const prevMsg = idx > 0 ? messages[idx - 1] : null;
                    const showDate = !prevMsg || 
                      format(new Date(msg.created_at), 'yyyy-MM-dd') !== format(new Date(prevMsg.created_at), 'yyyy-MM-dd');

                    return (
                      <div key={msg.id} className="space-y-4">
                        {showDate && (
                          <div className="flex justify-center my-4">
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                              {format(new Date(msg.created_at), 'EEEE d MMMM', { locale: fr })}
                            </span>
                          </div>
                        )}
                        <div className={cn(
                          "flex group animate-in fade-in slide-in-from-bottom-2 duration-300",
                          isMe ? "justify-end" : "justify-start"
                        )}>
                          <div className={cn(
                            "max-w-[70%] space-y-1",
                            isMe ? "items-end" : "items-start"
                          )}>
                            <div className={cn(
                              "px-4 py-2.5 rounded-2xl text-sm shadow-sm transition-all hover:shadow-md",
                              isMe 
                                ? "bg-blue-600 text-white rounded-tr-none" 
                                : "bg-white text-slate-800 rounded-tl-none border border-slate-100"
                            )}>
                              {msg.content}
                            </div>
                            <div className={cn(
                              "flex items-center gap-1 text-[10px] text-slate-400 px-1",
                              isMe ? "flex-row-reverse" : "flex-row"
                            )}>
                              <Clock className="h-2.5 w-2.5" />
                              {format(new Date(msg.created_at), 'HH:mm')}
                              {isMe && msg.is_read && (
                                <span className="ml-1 text-blue-500 font-bold">Vu</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 bg-white border-t">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  placeholder="Écrivez votre message..."
                  className="flex-1 bg-slate-50 border-none focus-visible:ring-blue-600 shadow-inner"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={sending}
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  disabled={!newMessage.trim() || sending}
                  className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all hover:scale-105 active:scale-95"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6 animate-bounce duration-[2000ms]">
              <MessageCircle className="h-12 w-12 text-blue-300" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Vos Conversations</h3>
            <p className="text-slate-500 max-w-sm">
              Sélectionnez un contact dans la liste pour commencer à discuter avec votre magasin, vos employés ou le superadmin.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}