import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import validator from 'validator';
import { v4 as uuidv4 } from 'uuid';

// Generate UUID
export const generateId = () => uuidv4();

// Hash password
export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(12);
  return await bcrypt.hash(password, salt);
};

// Compare password
export const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Generate JWT token
export const generateToken = (payload, expiresIn = '7d') => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

// Verify JWT token
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Generate random string
export const generateRandomString = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Validate email
export const isValidEmail = (email) => {
  return validator.isEmail(email);
};

// Validate URL
export const isValidUrl = (url) => {
  return validator.isURL(url);
};

// Sanitize input
export const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return validator.escape(input.trim());
  }
  return input;
};

// Format date
export const formatDate = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
  const d = new Date(date);
  const pad = (num) => num.toString().padStart(2, '0');
  
  const formats = {
    'YYYY': d.getFullYear(),
    'MM': pad(d.getMonth() + 1),
    'DD': pad(d.getDate()),
    'HH': pad(d.getHours()),
    'mm': pad(d.getMinutes()),
    'ss': pad(d.getSeconds())
  };
  
  return format.replace(/YYYY|MM|DD|HH|mm|ss/g, match => formats[match]);
};

// Pagination helper
export const paginate = (array, page = 1, limit = 10) => {
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  
  const results = {
    data: array.slice(startIndex, endIndex),
    pagination: {
      total: array.length,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(array.length / limit),
      hasNext: endIndex < array.length,
      hasPrev: startIndex > 0
    }
  };
  
  return results;
};

// Async sleep/delay
export const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Deep clone object
export const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

// Mask sensitive data
export const maskData = (data, visibleChars = 4) => {
  if (!data || typeof data !== 'string') return data;
  
  if (data.length <= visibleChars * 2) {
    return '*'.repeat(data.length);
  }
  
  const first = data.substring(0, visibleChars);
  const last = data.substring(data.length - visibleChars);
  const middle = '*'.repeat(data.length - (visibleChars * 2));
  
  return first + middle + last;
};

// Generate slug
export const generateSlug = (text) => {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// File size formatter
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Retry function with exponential backoff
export const retry = async (fn, maxAttempts = 3, delay = 1000) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await sleep(delay * Math.pow(2, attempt - 1));
    }
  }
};

// Validate phone number (Bangladeshi format)
export const isValidPhoneBD = (phone) => {
  const regex = /^(?:\+88|01)?(?:\d{11}|\d{13})$/;
  return regex.test(phone);
};

// Generate OTP
export const generateOTP = (length = 6) => {
  const digits = '0123456789';
  let otp = '';
  
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  
  return otp;
};

// Check if object is empty
export const isEmpty = (obj) => {
  if (!obj) return true;
  if (Array.isArray(obj)) return obj.length === 0;
  return Object.keys(obj).length === 0;
};

// Get current timestamp
export const getTimestamp = () => {
  return Math.floor(Date.now() / 1000);
};