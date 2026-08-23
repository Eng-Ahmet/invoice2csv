import mongoose from 'mongoose';

export const connectDatabase = async (): Promise<void> => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/invoice2csv';
  try {
    await mongoose.connect(mongoUri);
    console.log('🍃 Connected to MongoDB cluster successfully');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    // Non-fatal fallback for stateless RAM runs
  }
};
