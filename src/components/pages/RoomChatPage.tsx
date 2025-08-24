import { useState, useEffect } from "react";
import { Plus, Users, Hash, Send, MessageSquare, Upload, X, Smile, Paperclip, Mic, Download } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Room {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  owner_id: string;
  icon_url?: string;
}

interface RoomMessage {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  attachment_url?: string;
  attachment_type?: string;
  attachment_name?: string;
  profiles: {
    username: string;
    display_name: string;
    avatar_url?: string;
  };
}

interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
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

export function RoomChatPage() {
  const { user } = useAuth();
  const { playNotificationSound } = useNotifications();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [newRoom, setNewRoom] = useState({ name: "", description: "" });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [roomIcon, setRoomIcon] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string>("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string>("");
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [uploading, setUploading] = useState(false);
  const [subscriptionRef, setSubscriptionRef] = useState<any>(null);

  useEffect(() => {
    if (user) {
      loadRooms();
      loadAvailableUsers();
    }
  }, [user]);

  useEffect(() => {
    if (selectedRoom) {
      loadMessages(selectedRoom.id);
      subscribeToMessages(selectedRoom.id);
      
      return () => {
        if (subscriptionRef) {
          supabase.removeChannel(subscriptionRef);
        }
      };
    }
  }, [selectedRoom]);

  // Clear search data when component mounts (returning to page)
  useEffect(() => {
    setNewRoom({ name: "", description: "" });
    setSelectedUsers([]);
    setRoomIcon(null);
    setIconPreview("");
  }, []);

  const loadAvailableUsers = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .neq('id', user.id)
        .order('display_name', { ascending: true });

      if (error) throw error;
      setAvailableUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setRooms(data || []);
      
      // Auto-select first room if available
      if (data && data.length > 0 && !selectedRoom) {
        setSelectedRoom(data[0]);
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
      toast.error("Failed to load rooms");
    } finally {
      setLoading(false);
    }
  };

  const handleIconUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setRoomIcon(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setIconPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadRoomIcon = async (): Promise<string | null> => {
    if (!roomIcon || !user) return null;

    try {
      const fileExt = roomIcon.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `room-icons/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, roomIcon);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading icon:', error);
      toast.error("Failed to upload room icon");
      return null;
    }
  };

  const createRoom = async () => {
    if (!user || !newRoom.name.trim() || selectedUsers.length === 0) {
      toast.error("Please fill in room name and select at least one user");
      return;
    }

    try {
      // Upload room icon if selected
      let iconUrl = null;
      if (roomIcon) {
        iconUrl = await uploadRoomIcon();
      }

      const { data, error } = await supabase
        .from('rooms')
        .insert({
          name: newRoom.name,
          description: newRoom.description,
          owner_id: user.id,
          icon_url: iconUrl
        })
        .select()
        .single();

      if (error) throw error;

      // Add owner as a member
      await supabase
        .from('room_members')
        .insert({
          room_id: data.id,
          user_id: user.id,
          role: 'owner' as const
        });

      // Add selected users as members
      const memberInserts = selectedUsers.map(userId => ({
        room_id: data.id,
        user_id: userId,
        role: 'member' as const
      }));

      await supabase
        .from('room_members')
        .insert(memberInserts);

      // Reset form and close dialog
      setNewRoom({ name: "", description: "" });
      setSelectedUsers([]);
      setRoomIcon(null);
      setIconPreview("");
      setIsDialogOpen(false);
      
      // Reload rooms and select the new room
      await loadRooms();
      setSelectedRoom(data);
      
      toast.success("Room created successfully!");
    } catch (error) {
      console.error('Error creating room:', error);
      toast.error("Failed to create room");
    }
  };

  const handleUserSelection = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers(prev => [...prev, userId]);
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    }
  };

  const resetRoomForm = () => {
    setNewRoom({ name: "", description: "" });
    setSelectedUsers([]);
    setRoomIcon(null);
    setIconPreview("");
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

  const loadMessages = async (roomId: string) => {
    try {
      const { data, error } = await supabase
        .from('room_messages')
        .select(`
          id,
          content,
          created_at,
          sender_id,
          attachment_url,
          attachment_type,
          attachment_name,
          profiles:sender_id (
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error("Failed to load messages");
    }
  };

  const subscribeToMessages = (roomId: string) => {
    const channel = supabase
      .channel(`room-messages-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_messages',
          filter: `room_id=eq.${roomId}`
        },
        async (payload) => {
          // Fetch the complete message with profile data
          const { data } = await supabase
            .from('room_messages')
            .select(`
              id,
              content,
              created_at,
              sender_id,
              attachment_url,
              attachment_type,
              attachment_name,
              profiles:sender_id (
                username,
                display_name,
                avatar_url
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) {
            setMessages(prev => [...prev, data]);
            
            // Play notification sound if message is from other user
            if (data.sender_id !== user?.id) {
              playNotificationSound('room', false);
            }
          }
        }
      )
      .subscribe();

    setSubscriptionRef(channel);
  };

  const renderAttachment = (message: RoomMessage) => {
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

  const sendMessage = async () => {
    if (!user || !selectedRoom || (!newMessage.trim() && !selectedFile)) return;

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
        .from('room_messages')
        .insert({
          room_id: selectedRoom.id,
          sender_id: user.id,
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

  if (loading) {
    return (
      <div className="flex-1 p-6 bg-background">
        <div className="h-full flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex bg-background">
      {/* Rooms Sidebar */}
      <div className="w-80 border-r border-border bg-muted/30 flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold gradient-text">Rooms</h2>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gradient-button hover-glow">
                  <Plus size={16} />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="gradient-text">Create New Room</DialogTitle>
                  <DialogDescription>
                    Create a new chat room and invite friends to join.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Room Icon Upload */}
                  <div className="space-y-2">
                    <Label>Room Icon (Optional)</Label>
                    <div className="flex items-center gap-3">
                      {iconPreview ? (
                        <div className="relative">
                          <img 
                            src={iconPreview} 
                            alt="Room icon preview" 
                            className="w-16 h-16 rounded-lg object-cover border"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                              setRoomIcon(null);
                              setIconPreview("");
                            }}
                          >
                            <X size={12} />
                          </Button>
                        </div>
                      ) : (
                        <div className="w-16 h-16 border-2 border-dashed border-muted-foreground/25 rounded-lg flex items-center justify-center">
                          <Upload size={20} className="text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleIconUpload}
                          className="hidden"
                          id="room-icon-upload"
                        />
                        <Label 
                          htmlFor="room-icon-upload" 
                          className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                        >
                          Choose Icon
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Room Name */}
                  <div>
                    <Label htmlFor="roomName">Room Name *</Label>
                    <Input
                      id="roomName"
                      value={newRoom.name}
                      onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                      placeholder="Enter room name"
                      className="bg-muted border-0 hover-glow focus:glow-ring"
                    />
                  </div>

                  {/* Room Description */}
                  <div>
                    <Label htmlFor="roomDescription">Description (Optional)</Label>
                    <Textarea
                      id="roomDescription"
                      value={newRoom.description}
                      onChange={(e) => setNewRoom({ ...newRoom, description: e.target.value })}
                      placeholder="Describe your room"
                      className="bg-muted border-0 hover-glow focus:glow-ring"
                      rows={3}
                    />
                  </div>

                  {/* User Selection */}
                  <div>
                    <Label>Select Users to Invite *</Label>
                    <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-2">
                      {availableUsers.map((profile) => (
                        <div key={profile.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`user-${profile.id}`}
                            checked={selectedUsers.includes(profile.id)}
                            onCheckedChange={(checked) => 
                              handleUserSelection(profile.id, checked as boolean)
                            }
                          />
                          <Label 
                            htmlFor={`user-${profile.id}`}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={profile.avatar_url} />
                              <AvatarFallback className="text-xs">
                                {(profile.display_name || profile.username)[0]?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">
                              {profile.display_name || profile.username}
                            </span>
                          </Label>
                        </div>
                      ))}
                    </div>
                    {availableUsers.length === 0 && (
                      <p className="text-sm text-muted-foreground">No users available to invite</p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button 
                      onClick={createRoom} 
                      className="flex-1 gradient-button hover-glow"
                      disabled={!newRoom.name.trim() || selectedUsers.length === 0}
                    >
                      Create Room
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={resetRoomForm}
                      className="flex-1"
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {rooms.length === 0 ? (
            <div className="p-4 text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No rooms available</p>
              <p className="text-sm text-muted-foreground">Create your first room!</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {rooms.map((room) => (
                <Button
                  key={room.id}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start p-3 h-auto flex-col items-start gap-1",
                    selectedRoom?.id === room.id 
                      ? "bg-muted text-foreground gradient-border" 
                      : "hover-glow text-muted-foreground"
                  )}
                  onClick={() => setSelectedRoom(room)}
                >
                  <div className="flex items-center gap-2 w-full">
                    {room.icon_url ? (
                      <img 
                        src={room.icon_url} 
                        alt={room.name} 
                        className="w-4 h-4 rounded object-cover"
                      />
                    ) : (
                      <Hash size={16} />
                    )}
                    <span className="font-semibold truncate">{room.name}</span>
                  </div>
                  {room.description && (
                    <p className="text-xs text-muted-foreground truncate w-full text-left">
                      {room.description}
                    </p>
                  )}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      {selectedRoom ? (
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-border bg-card">
            <div className="flex items-center gap-3">
              {selectedRoom.icon_url ? (
                <img 
                  src={selectedRoom.icon_url} 
                  alt={selectedRoom.name} 
                  className="w-8 h-8 rounded object-cover"
                />
              ) : (
                <Hash size={20} className="text-primary" />
              )}
              <div>
                <h3 className="font-semibold gradient-text">{selectedRoom.name}</h3>
                {selectedRoom.description && (
                  <p className="text-sm text-muted-foreground">{selectedRoom.description}</p>
                )}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Hash className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold gradient-text mb-2">
                    Welcome to #{selectedRoom.name}!
                  </h3>
                  <p className="text-muted-foreground">
                    Start the conversation by sending a message.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="flex items-start gap-3">
                  <Avatar className="h-8 w-8 mt-1">
                    <AvatarImage src={message.profiles.avatar_url} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {(message.profiles.display_name || message.profiles.username)[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">
                        {message.profiles.display_name || message.profiles.username}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(message.created_at).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                    <p className="text-sm">{message.content}</p>
                    {renderAttachment(message)}
                  </div>
                </div>
              ))
            )}
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
                  placeholder={`Message #${selectedRoom.name}`}
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
      ) : (
        <div className="flex-1 flex items-center justify-center bg-background">
          <div className="text-center">
            <Hash className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-xl font-semibold gradient-text mb-2">Select a Room</h3>
            <p className="text-muted-foreground">
              Choose a room from the sidebar to start chatting!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}