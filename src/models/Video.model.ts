import mongoose, { Schema, Document } from 'mongoose';

export interface IVideo extends Document {
  _id: string;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  size: number;
  format: string;
  resolution: string;
  user: string;
  likes: string[];
  comments: string[];
  shares: number;
  views: number;
  tags: string[];
  category: string;
  isPublic: boolean;
  isCommentsEnabled: boolean;
  isDownloadable: boolean;
  location?: {
    type: string;
    coordinates: [number, number];
    name?: string;
  };
  metadata: {
    width: number;
    height: number;
    aspectRatio: string;
    frameRate: number;
    bitrate: number;
  };
  status: 'processing' | 'ready' | 'failed';
  processingProgress: number;
  uploadedAt: Date;
  publishedAt?: Date;
}

const VideoSchema: Schema = new Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    maxlength: [2000, 'Description cannot exceed 2000 characters'],
    default: ''
  },
  videoUrl: {
    type: String,
    required: [true, 'Video URL is required']
  },
  thumbnailUrl: {
    type: String,
    required: [true, 'Thumbnail URL is required']
  },
  duration: {
    type: Number,
    required: [true, 'Duration is required'],
    min: [0.1, 'Duration must be at least 0.1 seconds']
  },
  size: {
    type: Number,
    required: [true, 'Size is required'],
    min: [0, 'Size must be positive']
  },
  format: {
    type: String,
    required: [true, 'Format is required']
  },
  resolution: {
    type: String,
    default: '1920x1080'
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  likes: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [{
    type: Schema.Types.ObjectId,
    ref: 'Comment'
  }],
  shares: {
    type: Number,
    default: 0
  },
  views: {
    type: Number,
    default: 0
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  category: {
    type: String,
    enum: [
      'entertainment', 'education', 'sports', 'music', 
      'gaming', 'comedy', 'lifestyle', 'news', 'other'
    ],
    default: 'other'
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  isCommentsEnabled: {
    type: Boolean,
    default: true
  },
  isDownloadable: {
    type: Boolean,
    default: false
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    },
    name: String
  },
  metadata: {
    width: Number,
    height: Number,
    aspectRatio: String,
    frameRate: Number,
    bitrate: Number
  },
  status: {
    type: String,
    enum: ['processing', 'ready', 'failed'],
    default: 'processing'
  },
  processingProgress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  publishedAt: Date
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    virtuals: true
  }
});

// Virtuals
VideoSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

VideoSchema.virtual('commentCount').get(function() {
  return this.comments.length;
});

VideoSchema.virtual('engagementRate').get(function() {
  const totalEngagement = this.likes.length + this.comments.length + this.shares;
  return this.views > 0 ? (totalEngagement / this.views) * 100 : 0;
});

// Indexes
VideoSchema.index({ user: 1, createdAt: -1 });
VideoSchema.index({ likes: -1 });
VideoSchema.index({ views: -1 });
VideoSchema.index({ tags: 1 });
VideoSchema.index({ category: 1 });
VideoSchema.index({ status: 1 });
VideoSchema.index({ title: 'text', description: 'text', tags: 'text' });
VideoSchema.index({ location: '2dsphere' });
VideoSchema.index({ uploadedAt: -1 });
VideoSchema.index({ publishedAt: -1 });

// Methods
VideoSchema.methods.incrementViews = async function() {
  this.views += 1;
  await this.save();
};

VideoSchema.methods.toggleLike = async function(userId: string) {
  const userIndex = this.likes.indexOf(userId);
  
  if (userIndex === -1) {
    this.likes.push(userId);
  } else {
    this.likes.splice(userIndex, 1);
  }
  
  await this.save();
  return userIndex === -1; // Returns true if liked, false if unliked
};

// Static methods
VideoSchema.statics.findByUserId = function(userId: string, page: number = 1, limit: number = 20) {
  const skip = (page - 1) * limit;
  
  return this.find({ user: userId, isPublic: true, status: 'ready' })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'username profilePicture fullName');
};

VideoSchema.statics.findTrending = function(page: number = 1, limit: number = 20) {
  const skip = (page - 1) * limit;
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  return this.find({
    isPublic: true,
    status: 'ready',
    publishedAt: { $gte: weekAgo }
  })
    .sort({ likes: -1, views: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'username profilePicture fullName');
};

export default mongoose.model<IVideo>('Video', VideoSchema);