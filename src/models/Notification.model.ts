import mongoose, { Schema, Document } from 'mongoose';

export type NotificationType = 
  | 'like' 
  | 'comment' 
  | 'follow' 
  | 'mention' 
  | 'share' 
  | 'new_video' 
  | 'system';

export interface INotification extends Document {
  _id: string;
  recipient: string;
  sender?: string;
  type: NotificationType;
  read: boolean;
  data: {
    video?: string;
    comment?: string;
    message?: string;
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema: Schema = new Schema({
  recipient: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Recipient is required']
  },
  sender: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    enum: ['like', 'comment', 'follow', 'mention', 'share', 'new_video', 'system'],
    required: [true, 'Notification type is required']
  },
  read: {
    type: Boolean,
    default: false
  },
  data: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes
NotificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ sender: 1, recipient: 1, type: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: -1 });

// Static methods
NotificationSchema.statics.findByRecipient = function(
  recipientId: string, 
  page: number = 1, 
  limit: number = 20,
  unreadOnly: boolean = false
) {
  const skip = (page - 1) * limit;
  const query: any = { recipient: recipientId };
  
  if (unreadOnly) {
    query.read = false;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('sender', 'username profilePicture fullName')
    .populate('data.video', 'title thumbnailUrl')
    .populate('data.comment', 'content');
};

NotificationSchema.statics.markAsRead = async function(notificationIds: string[]) {
  return this.updateMany(
    { _id: { $in: notificationIds } },
    { $set: { read: true } }
  );
};

NotificationSchema.statics.markAllAsRead = async function(recipientId: string) {
  return this.updateMany(
    { recipient: recipientId, read: false },
    { $set: { read: true } }
  );
};

export default mongoose.model<INotification>('Notification', NotificationSchema);