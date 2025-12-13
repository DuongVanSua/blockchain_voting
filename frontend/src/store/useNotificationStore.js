import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useNotificationStore = create(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,


      addNotification: (notification) => {
        const newNotification = {
          id: Date.now().toString(),
          type: notification.type || 'info',
          title: notification.title,
          message: notification.message,
          timestamp: new Date().toISOString(),
          read: false,
          actionUrl: notification.actionUrl,
          actionLabel: notification.actionLabel,
          ...notification,
        };

        set((state) => ({
          notifications: [newNotification, ...state.notifications].slice(0, 100),
          unreadCount: state.unreadCount + 1,
        }));

        return newNotification;
      },


      markAsRead: (notificationId) => {
        set((state) => {
          const updated = state.notifications.map((n) =>
            n.id === notificationId ? { ...n, read: true } : n
          );
          const unreadCount = updated.filter((n) => !n.read).length;
          return {
            notifications: updated,
            unreadCount,
          };
        });
      },


      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        }));
      },


      deleteNotification: (notificationId) => {
        set((state) => {
          const notification = state.notifications.find((n) => n.id === notificationId);
          const updated = state.notifications.filter((n) => n.id !== notificationId);
          return {
            notifications: updated,
            unreadCount: notification && !notification.read
              ? state.unreadCount - 1
              : state.unreadCount,
          };
        });
      },


      clearAll: () => {
        set({
          notifications: [],
          unreadCount: 0,
        });
      },


      getUnreadNotifications: () => {
        return get().notifications.filter((n) => !n.read);
      },
    }),
    {
      name: 'notification-storage',
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Error rehydrating notification store:', error);
        }
      },
    }
  )
);

export default useNotificationStore;

