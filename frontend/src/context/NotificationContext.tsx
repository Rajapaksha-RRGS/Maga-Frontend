/**
 * NotificationContext.tsx
 *
 * Global Notification and Alert Management System.
 * Collects system warnings, operational alerts, and ERP sync notifications
 * into the top header notification bell instead of showing cluttered warnings
 * on the main screen.
 */
import { createContext, useContext, useState, useMemo, type ReactNode } from 'react';

export type NotificationType = 'warning' | 'info' | 'success' | 'error';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  timestamp: string;
  read: boolean;
  link?: string;
  actionText?: string;
}

interface NotificationContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  addNotification: (item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Labour Assignments Incomplete',
    message: 'There are unassigned employees for today. Assign them to supervisors before shift start.',
    type: 'warning',
    timestamp: '10m ago',
    read: false,
    link: '/admin/assignments/labour',
    actionText: 'View Labour Assign',
  },
  {
    id: 'notif-2',
    title: 'Daily Attendance Pending Verification',
    message: 'Supervisor logs have been submitted and are awaiting admin approval.',
    type: 'warning',
    timestamp: '25m ago',
    read: false,
    link: '/admin/approvals',
    actionText: 'Review Approvals',
  },
  {
    id: 'notif-3',
    title: 'Corporate ERP Master Catalog Synchronized',
    message: 'Central ERP equipment, partner, employee, and activity master lists are up to date.',
    type: 'info',
    timestamp: '1h ago',
    read: true,
  },
];

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const addNotification = (item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: NotificationItem = {
      ...item,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: 'Just now',
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        removeNotification,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
