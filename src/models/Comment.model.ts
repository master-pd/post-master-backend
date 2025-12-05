import mongoose, { Schema, Document } from 'mongoose';

export interface IComment extends Document {
  _id: string;
  content: string;
  user: string;
  video: string;
  parentComment?: string;
  replies: string[];
  likes: string[];
  isEdited: boolean;
  editedAt?: Date;
  isPinned: boolean;
  pinnedAt?: Date;
  metadata: {
    ipAddress?: string;
    userAgent?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema: Schema = new Schema({
  content: {
    type: String,
    required: [true, 'Comment content is required'],
    trim: true,
    maxlength: [2000, 'Comment cannot exceed 2000 characters']
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  video: {
    type: Schema.Types.ObjectId,
    ref: 'Video',
    required: [true, 'Video is required']
  },
  parentComment: {
    type: Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  replies: [{
    type: Schema.Types.ObjectId,
    ref: 'Comment'
  }],
  likes: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  isPinned: {
    type: Boolean,
    default: false
  },
  pinnedAt: Date,
  metadata: {
    ipAddress: String,
    userAgent: String
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      delete ret.metadata;
      return ret;
    }
  },
  toObject: {
    virtuals: true
  }
});

// Virtuals
CommentSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

CommentSchema.virtual('replyCount').get(function() {
  return this.replies.length;
});

// Indexes
CommentSchema.index({ video: 1, createdAt: -1 });
CommentSchema.index({ user: 1, createdAt: -1 });
CommentSchema.index({ parentComment: 1 });
CommentSchema.index({ isPinned: 1 });
CommentSchema.index({ likes: -1 });

// Middleware to handle reply counting
CommentSchema.pre('save', async function(next) {
  if (this.parentComment && this.isNew) {
    try {
      const parent = await mongoose.model('Comment').findById(this.parentComment);
      if (parent && !parent.replies.includes(this._id)) {
        parent.replies.push(this._id);
        await parent.save();
      }
    } catch (error) {
      return next(error as Error);
    }
  }
  next();
});

// Static methods
CommentSchema.statics.findByVideoId = function(videoId: string, page: number = 1, limit: number = 50) {
  const skip = (page - 1) * limit;
  
  return this.find({
    video: videoId,
    parentComment: null
  })
    .sort({ isPinned: -1, likes: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'username profilePicture fullName')
    .populate({
      path: 'replies',
      options: { limit: 5, sort: { likes: -1 } },
      populate: {
        path: 'user',
        select: 'username profilePicture fullName'
      }
    });
};

CommentSchema.statics.findReplies = function(commentId: string, page: number = 1, limit: number = 20) {
  const skip = (page - 1) * limit;
  
  return this.find({
    parentComment: commentId
  })
    .sort({ likes: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'username profilePicture fullName');
};

export default mongoose.model<IComment>('Comment', CommentSchema);