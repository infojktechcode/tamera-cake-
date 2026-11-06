/**
 * Customer notification module — public exports.
 */

export {
  notifyOrderStatusChange,
  queueNotification,
  sendNotification,
  type SendResult,
  type NotificationChannel,
} from "./service";
export { notifyOnStatusChange } from "./triggers";
export { africastalkingProvider, mockProvider, resetMock, type NotificationProvider } from "./providers";