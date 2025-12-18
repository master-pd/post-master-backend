import Joi from 'joi';

// User validators
export const userSchemas = {
  register: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    password: Joi.string()
      .min(8)
      .max(100)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'Password is required'
      }),
    name: Joi.string().min(2).max(100).required().messages({
      'string.min': 'Name must be at least 2 characters long',
      'any.required': 'Name is required'
    }),
    phone: Joi.string().pattern(/^(?:\+88|01)?(?:\d{11}|\d{13})$/).optional()
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  updateProfile: Joi.object({
    name: Joi.string().min(2).max(100),
    phone: Joi.string().pattern(/^(?:\+88|01)?(?:\d{11}|\d{13})$/),
    bio: Joi.string().max(500)
  })
};

// Post validators
export const postSchemas = {
  create: Joi.object({
    title: Joi.string().min(3).max(200).required(),
    content: Joi.string().min(10).max(10000).required(),
    tags: Joi.array().items(Joi.string().max(50)).max(10),
    isPublished: Joi.boolean().default(true),
    category: Joi.string().max(50)
  }),

  update: Joi.object({
    title: Joi.string().min(3).max(200),
    content: Joi.string().min(10).max(10000),
    tags: Joi.array().items(Joi.string().max(50)).max(10),
    isPublished: Joi.boolean(),
    category: Joi.string().max(50)
  })
};

// File upload validators
export const fileSchemas = {
  image: Joi.object({
    file: Joi.any().required()
  }),

  video: Joi.object({
    file: Joi.any().required(),
    duration: Joi.number().max(300) // max 5 minutes
  })
};

// Chat validators
export const chatSchemas = {
  createMessage: Joi.object({
    content: Joi.string().min(1).max(2000).required(),
    receiverId: Joi.string().uuid().required(),
    type: Joi.string().valid('text', 'image', 'video').default('text')
  }),

  createGroup: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    members: Joi.array().items(Joi.string().uuid()).min(2).required(),
    description: Joi.string().max(500)
  })
};

// Pagination validator
export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  search: Joi.string().max(100)
});

// Common validators
export const commonSchemas = {
  idParam: Joi.object({
    id: Joi.string().uuid().required()
  }),

  email: Joi.object({
    email: Joi.string().email().required()
  }),

  pagination: Joi.object({
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(20)
  })
};

// Validate function
export const validate = (schema, data) => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    
    throw {
      name: 'ValidationError',
      message: 'Validation failed',
      details: errors
    };
  }
  
  return value;
};

// Custom validators
export const customValidators = {
  // Validate Bangladeshi phone number
  bdPhone: (value, helpers) => {
    const regex = /^(?:\+88|01)?(?:\d{11}|\d{13})$/;
    if (!regex.test(value)) {
      return helpers.error('string.pattern.base', { value });
    }
    return value;
  },

  // Validate strong password
  strongPassword: (value, helpers) => {
    const hasUpperCase = /[A-Z]/.test(value);
    const hasLowerCase = /[a-z]/.test(value);
    const hasNumbers = /\d/.test(value);
    const hasSpecialChar = /[@$!%*?&]/.test(value);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      return helpers.error('string.pattern.base', { value });
    }
    
    return value;
  },

  // Validate date is not in future
  notFutureDate: (value, helpers) => {
    const inputDate = new Date(value);
    const today = new Date();
    
    if (inputDate > today) {
      return helpers.error('date.max', { limit: 'today' });
    }
    
    return value;
  }
};