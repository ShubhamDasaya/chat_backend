// import mongoose from 'mongoose';
// import dotenv from 'dotenv';

// dotenv.config();

// const connectDb = async () => {
//     try {
//         await mongoose.connect(process.env.MONGO_URL);
//         console.log("✅ MongoDB connected");
//     } catch (error) {
//         console.error("❌ MongoDB connection failed:", error.message);
//         process.exit(1);
//     }
// };

// export default connectDb;

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';  // Add this import

dotenv.config();

// Force Node.js to use Google's DNS servers
// This bypasses local network DNS issues that cause querySrv ECONNREFUSED
dns.setServers(['8.8.8.8', '1.1.1.1']);
console.log('MONGO_URL:', process.env.MONGO_URL);
console.log('PORT:', process.env.PORT);
const connectDb = async () => {
    try {
        // Optional: Log which database we're connecting to (without exposing password)
        const sanitizedUrl = process.env.MONGO_URL?.replace(/\/\/([^:]+):([^@]+)@/, '//<username>:<password>@');
        console.log(`Attempting to connect to MongoDB...`);
        console.log('MONGO_URL:', process.env.MONGO_URL);
        console.log('PORT:', process.env.PORT);
        await mongoose.connect(process.env.MONGO_URL);
        console.log("✅ MongoDB connected");
    } catch (error) {
        console.error("❌ MongoDB connection failed:", error.message);
        process.exit(1);
    }
};

export default connectDb;