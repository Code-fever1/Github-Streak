/** @deprecated Use notification-alerts.ts */
export {
  loadNotificationAlertSettings as loadFiverrAlertSettings,
  saveNotificationAlertSettings as saveFiverrAlertSettings,
  testNotificationAlert as testFiverrAlert,
  stopNotificationAlert as stopFiverrAlert,
  isNotificationListenerEnabled,
  openNotificationListenerSettings,
  onAppForeground,
  type NotificationAlertMode as FiverrAlertMode,
  type NotificationAlertSettings as FiverrAlertSettings,
} from './notification-alerts';
