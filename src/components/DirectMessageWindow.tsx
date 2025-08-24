import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Smile, Paperclip, Mic, X, Download, Play, Pause } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DirectMessage {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  receiver_id: string;
  attachment_url?: string;
  attachment_type?: string;
  attachment_name?: string;
}

interface OtherUser {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
}

interface DirectMessageWindowProps {
  otherUserId: string;
}

const EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇",
  "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚",
  "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩",
  "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣",
  "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬",
  "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗",
  "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😯", "😦", "😧",
  "😮", "😲", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮",
  "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "💩", "👻", "💀", "☠️",
  "👽", "👾", "🤖", "😺", "😸", "😹", "😻", "😼", "😽", "🙀"
];

const MESSAGES_PER_PAGE = 20;

export function DirectMessageWindow({ otherUserId }: DirectMessageWindowProps) {
  const { user } = useAuth();
  const { playNotificationSound } = useNotifications();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string>("");
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [oldestMessageId, setOldestMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    if (otherUserId && user) {
      loadOtherUser();
      loadMessages();
      subscribeToMessages();
      
      return () => {
        if (subscriptionRef.current) {
          supabase.removeChannel(subscriptionRef.current);
        }
      };
    }
  }, [otherUserId, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadOtherUser = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .eq('id', otherUserId)
        .single();

      if (error) throw error;
      setOtherUser(data);
    } catch (error) {
      console.error('Error loading user:', error);
      toast.error("Failed to load user information");
    }
  };

  const loadMessages = async (loadMore: boolean = false) => {
    try {
      let query = supabase
        .from('direct_messages')
        .select('*')
        .or(`and(sender_id.eq.${user?.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user?.id})`)
        .order('created_at', { ascending: false })
        .limit(MESSAGES_PER_PAGE);

      if (loadMore && oldestMessageId) {
        query = query.lt('id', oldestMessageId);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (loadMore) {
        setMessages(prev => [...prev, ...(data || []).reverse()]);
      } else {
        setMessages(data || []);
      }

      if (data && data.length > 0) {
        setOldestMessageId(data[data.length - 1].id);
        setHasMoreMessages(data.length === MESSAGES_PER_PAGE);
      } else {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error("Failed to load messages");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreMessages = useCallback(async () => {
    if (loadingMore || !hasMoreMessages) return;
    
    setLoadingMore(true);
    await loadMessages(true);
  }, [loadingMore, hasMoreMessages]);

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`direct-messages-${otherUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `and(or(and(sender_id.eq.${user?.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user?.id})))`
        },
        (payload) => {
          const newMsg = payload.new as DirectMessage;
          setMessages(prev => [newMsg, ...prev]);
          
          // Play notification sound if message is from other user
          if (newMsg.sender_id === otherUserId) {
            playNotificationSound('dm', false);
          }
        }
      )
      .subscribe();

    subscriptionRef.current = channel;
  };

  const addEmoji = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setFilePreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview("");
      }
    }
  };

  const uploadFile = async (): Promise<string | null> => {
    if (!selectedFile || !user) return null;

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `attachments/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error("Failed to upload file");
      return null;
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/wav' });
        setAudioChunks(chunks);
        
        // Convert blob to file
        const audioFile = new File([audioBlob], `voice-note-${Date.now()}.wav`, { type: 'audio/wav' });
        setSelectedFile(audioFile);
        setFilePreview("audio");
      };

      setMediaRecorder(recorder);
      recorder.start();
      setRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error("Failed to start recording");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && recording) {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      setRecording(false);
    }
  };

  const sendMessage = async () => {
    if (!user || !newMessage.trim() && !selectedFile) return;

    setSending(true);
    try {
      let attachmentUrl = null;
      let attachmentType = null;
      let attachmentName = null;

      if (selectedFile) {
        attachmentUrl = await uploadFile();
        attachmentType = selectedFile.type;
        attachmentName = selectedFile.name;
      }

      const { error } = await supabase
        .from('direct_messages')
        .insert({
          sender_id: user.id,
          receiver_id: otherUserId,
          content: newMessage.trim() || (selectedFile ? "Sent an attachment" : ""),
          attachment_url: attachmentUrl,
          attachment_type: attachmentType,
          attachment_name: attachmentName
        });

      if (error) throw error;

      setNewMessage("");
      setSelectedFile(null);
      setFilePreview("");
      setAudioChunks([]);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const renderAttachment = (message: DirectMessage) => {
    if (!message.attachment_url) return null;

    if (message.attachment_type?.startsWith('image/')) {
      return (
        <div className="mt-2">
          <img 
            src={message.attachment_url} 
            alt="Attachment" 
            className="max-w-xs rounded-lg cursor-pointer hover:opacity-80"
            onClick={() => window.open(message.attachment_url, '_blank')}
          />
        </div>
      );
    }

    if (message.attachment_type?.startsWith('audio/')) {
      return (
        <div className="mt-2">
          <audio controls className="max-w-xs">
            <source src={message.attachment_url} type={message.attachment_type} />
            Your browser does not support the audio element.
          </audio>
        </div>
      );
    }

    return (
      <div className="mt-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2"
          onClick={() => window.open(message.attachment_url, '_blank')}
        >
          <Download size={16} />
          {message.attachment_name || "Download Attachment"}
        </Button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!otherUser) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">User not found</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Chat Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 glow-ring">
            <AvatarImage src={otherUser.avatar_url} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {(otherUser.display_name || otherUser.username)[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-foreground gradient-text">
              {otherUser.display_name || otherUser.username}
            </h3>
            <p className="text-sm text-muted-foreground">@{otherUser.username}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
        onScroll={(e) => {
          const target = e.target as HTMLDivElement;
          if (target.scrollTop === 0 && hasMoreMessages && !loadingMore) {
            loadMoreMessages();
          }
        }}
      >
        {/* Load More Button */}
        {hasMoreMessages && (
          <div className="text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={loadMoreMessages}
              disabled={loadingMore}
              className="mx-auto"
            >
              {loadingMore ? (
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
              ) : null}
              Load More Messages
            </Button>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Avatar className="h-16 w-16 mx-auto mb-4">
                <AvatarImage src={otherUser.avatar_url} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {(otherUser.display_name || otherUser.username)[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <h3 className="text-lg font-semibold gradient-text mb-2">
                {otherUser.display_name || otherUser.username}
              </h3>
              <p className="text-muted-foreground">
                This is the beginning of your conversation with @{otherUser.username}
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.sender_id === user?.id ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-xs lg:max-w-md px-4 py-2 rounded-2xl transition-all duration-300",
                  message.sender_id === user?.id
                    ? "gradient-button text-white hover-glow"
                    : "bg-muted text-foreground hover:bg-muted/80 hover-glow"
                )}
              >
                <p className="text-sm">{message.content}</p>
                {renderAttachment(message)}
                <p className="text-xs opacity-70 mt-1">
                  {new Date(message.created_at).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* File Preview */}
      {selectedFile && (
        <div className="px-4 py-2 border-t border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Paperclip size={16} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground flex-1 truncate">
              {selectedFile.name}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => {
                setSelectedFile(null);
                setFilePreview("");
              }}
            >
              <X size={12} />
            </Button>
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Input
              placeholder={`Message @${otherUser.username}`}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              className="pr-32 bg-muted border-0 hover-glow focus:glow-ring min-h-[44px]"
              disabled={sending}
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
              {/* Emoji Picker */}
              <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-10 w-10 hover-glow touch-manipulation"
                    aria-label="Open emoji picker"
                  >
                    <Smile size={18} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-80 p-2 max-h-96 overflow-y-auto" 
                  align="end"
                  side="top"
                >
                  <div className="grid grid-cols-8 gap-1">
                    {EMOJIS.map((emoji, index) => (
                      <Button
                        key={index}
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 text-lg hover:bg-muted touch-manipulation"
                        onClick={() => addEmoji(emoji)}
                      >
                        {emoji}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* File Upload */}
              <input
                type="file"
                accept="*/*"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
                disabled={uploading}
              />
              <label htmlFor="file-upload">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-10 w-10 hover-glow cursor-pointer touch-manipulation"
                  aria-label="Upload file"
                >
                  <Paperclip size={18} />
                </Button>
              </label>

              {/* Voice Recording */}
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-10 w-10 hover-glow touch-manipulation",
                  recording && "bg-destructive text-destructive-foreground"
                )}
                onClick={recording ? stopRecording : startRecording}
                disabled={uploading}
                aria-label={recording ? "Stop recording" : "Start voice recording"}
              >
                {recording ? (
                  <div className="w-5 h-5 bg-current rounded-full animate-pulse" />
                ) : (
                  <Mic size={18} />
                )}
              </Button>
            </div>
          </div>
          <Button 
            onClick={sendMessage}
            disabled={(!newMessage.trim() && !selectedFile) || sending}
            size="icon"
            className="gradient-button hover-glow h-10 w-10 touch-manipulation"
            aria-label="Send message"
          >
            {sending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}