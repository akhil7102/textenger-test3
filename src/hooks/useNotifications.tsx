import { useState, useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

interface NotificationSettings {
  soundEnabled: boolean;
  soundVolume: number;
}

export function useNotifications() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>({
    soundEnabled: true,
    soundVolume: 0.7
  });
  const [isMobile, setIsMobile] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load user notification settings
  useEffect(() => {
    if (user) {
      loadNotificationSettings();
    }
  }, [user]);

  // Initialize audio element
  useEffect(() => {
    if (!isMobile && settings.soundEnabled) {
      audioRef.current = new Audio('/notification-sound.mp3');
      audioRef.current.volume = settings.soundVolume;
      audioRef.current.preload = 'auto';
    }
  }, [isMobile, settings.soundEnabled, settings.soundVolume]);

  const loadNotificationSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('notification_sound_enabled, notification_sound_volume')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading notification settings:', error);
        return;
      }

      if (data) {
        setSettings({
          soundEnabled: data.notification_sound_enabled ?? true,
          soundVolume: data.notification_sound_volume ?? 0.7
        });
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const saveNotificationSettings = async (newSettings: Partial<NotificationSettings>) => {
    if (!user) return;

    try {
      setIsLoading(true);
      const updatedSettings = { ...settings, ...newSettings };
      
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          notification_sound_enabled: updatedSettings.soundEnabled,
          notification_sound_volume: updatedSettings.soundVolume,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setSettings(updatedSettings);
      
      // Update audio element if needed
      if (audioRef.current) {
        audioRef.current.volume = updatedSettings.soundVolume;
      }
    } catch (error) {
      console.error('Error saving notification settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const playNotificationSound = async (messageType: 'dm' | 'room', isCurrentChat: boolean = false) => {
    // Don't play sound if user is in the current chat
    if (isCurrentChat) return;

    // Don't play sound if disabled
    if (!settings.soundEnabled) return;

    try {
      if (isMobile) {
        // Use device notification system on mobile
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('New Message', {
            body: `You have a new ${messageType === 'dm' ? 'direct message' : 'room message'}`,
            icon: '/favicon.ico',
            silent: false // Use device default sound
          });
        }
      } else {
        // Play custom sound on desktop
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          await audioRef.current.play();
        }
      }
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  };

  const toggleSound = () => {
    saveNotificationSettings({ soundEnabled: !settings.soundEnabled });
  };

  const updateVolume = (volume: number) => {
    saveNotificationSettings({ soundVolume: volume });
  };

  return {
    settings,
    isLoading,
    isMobile,
    playNotificationSound,
    toggleSound,
    updateVolume,
    saveNotificationSettings
  };
}
