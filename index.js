const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const axios = require('axios');
const admin = require('firebase-admin');
const SSLCommerzPayment = require("sslcommerz-lts");

dotenv.config();
const app = express();
const port = process.env.PORT || 4000;

// Firestore Admin SDK init
const serviceAccount = require('./firebase/serviceAccountKey.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// Middleware setup
app.use(
    cors({
        origin: [
            "http://localhost:5175", "http://localhost:5176",
            "http://localhost:5174", "http://localhost:5173",
            "https://bijoy313.com", "https://bijoy-project-da7d9.web.app",
            "https://bijoy-project-da7d9.firebaseapp.com"
        ],
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"]
    })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB URI and Client
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tnxofuo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// Declare collections globally
let productsCollection;
let cartsCollection
let favoritesCollection 
let reviewsCollection 
let usersCollection
let usersWallets 
let otpCollection
let activeJobsCollection 
let activeJobReportCollection 
let userCompleteTask 
let activeJobPymentReport
let activeJobUpdate
let paymentsCollection
let orderCollection 
let depositCollection
let microJobCategory
let microJobsPost
let appliedMicroJobs 
let microJobPendingWorks
let microJobCancelWorks 
let microJobCompletedWorks
let withdrawReports 
let adminRequest 
let resellerInfo 
let headlineUpdate
// Optional: SMS config
const SMS_API_KEY = 'bFmnZedJjsrnK1pL9LZU';
const SMS_SENDER_ID = '8809617627038';
const SMS_API_URL = 'http://bulksmsbd.net/api/smsapi';
const sendAdminSMS = async (message) => {
    try {
        const adminNumber = '01736600480';
        const response = await axios.get(SMS_API_URL, {
            params: {
                api_key: SMS_API_KEY,
                senderid: SMS_SENDER_ID,
                number: adminNumber,
                message
            }
        });
        console.log('SMS sent to admin:', response.data);
    } catch (error) {
        console.error('Failed to send SMS:', error);
    }
};

// MongoDB run function
async function run() {
    try {
        await client.connect();
        const db = client.db("bijoy_db");

        //? Assign collections start 
        headlineUpdate = db.collection("headline");
        productsCollection = db.collection("products");
        cartsCollection = db.collection("carts");
        favoritesCollection = db.collection("favorites");
        reviewsCollection = db.collection("reviews");
        usersCollection = db.collection("users")
        usersWallets = db.collection("wallets")
        otpCollection = db.collection("otps")
        activeJobsCollection = db.collection("active_jobs")
        activeJobReportCollection = db.collection("active_job_reports")
        userCompleteTask = db.collection("user_completed_works")
        activeJobPymentReport = db.collection("active_job_payment_report")
        activeJobUpdate = db.collection("active_job_update")
        paymentsCollection = db.collection("payments")
        orderCollection = db.collection("order_collections")
        depositCollection = db.collection("deposit")
        microJobCategory = db.collection("microjob_categories")
        microJobsPost = db.collection("micro_jobs")
        appliedMicroJobs = db.collection("applied_micro_jobs")
        microJobPendingWorks = db.collection("microjob_pending_works")
        microJobCancelWorks = db.collection("micro_job_cancel_works")
        microJobCompletedWorks = db.collection("microjob_comlete_works")
        withdrawReports = db.collection("withdraw_reports")
        adminRequest = db.collection("admin_request")
        resellerInfo = db.collection("reseller_info")
        




        async function getUserPostedJobCount(userUid) {
            try {
                const count = await microJobsPost.countDocuments({ uid: userUid });
                return count;
            } catch (error) {
                console.error("Error counting posted jobs:", error);
                return 0;
            }
        }


        const monitorReferralBonuses = async () => {
            try {
                const allUsers = await usersCollection.find({}).toArray();
                const allWallets = await usersWallets.find({}).toArray();

                let updatedCount = 0;

                for (const user of allUsers) {
                    // ✅ চেক করো user paid কিনা, referredBy আছে কিনা, এবং reward দেওয়া হয়নি
                    if (user.payment === 'paid' && user.referredBy) {
                        const referrer = allUsers.find(u => u.referralCode === user.referredBy);
                        if (!referrer || !referrer.firebaseUID) continue;

                        const updateRes = await usersCollection.updateOne(
                            { _id: user._id, referralRewarded: { $ne: true } },
                            { $set: { referralRewarded: true } }
                        );

                        if (updateRes.modifiedCount > 0) {
                            await usersWallets.updateOne(
                                { uid: referrer.firebaseUID },
                                {
                                    $inc: {
                                        refererBalance: 120,
                                        totalBalance: 120
                                    }
                                }
                            );

                            console.log(`🎁 ${referrer.displayName} earned 120৳ from ${user.displayName}`);
                            updatedCount++;
                        }

                    }


                }

                console.log(`✅ Referral bonus monitor done. Total referrers rewarded: ${updatedCount}`);
            } catch (error) {
                console.error("❌ Error in monitorReferralBonuses:", error.message);
            }
        };
        // Leadership level checking functions
        async function monitorLeadershipLevels() {
            try {
                // ✅ Using globally assigned usersCollection (don't create again)
                const allPaidMembers = await usersCollection.find({ payment: "paid" }).toArray();

                for (const member of allPaidMembers) {
                    await checkAndUpdateLeadershipLevel(member, usersCollection);
                }

                console.log("Leadership levels monitoring completed.");
            } catch (error) {
                console.error("Error in leadership monitoring:", error);
            }
        }


        async function checkAndUpdateLeadershipLevel(member, usersCollection) {
            // Check for বিজয় নিয়ামাহ level
            await checkBijoyNiamah(member, usersCollection);

            // Check for বিজয় বারাকাহ level
            await checkBijoyBarakah(member, usersCollection);

            // Check for বিজয় আমানাহ level
            await checkBijoyAmanah(member, usersCollection);

            // Check for বিজয় সালামাহ level
            await checkBijoySalamah(member, usersCollection);

            // Check for বিজয় রাহবার level
            await checkBijoyRahbar(member, usersCollection);
        }

        // বিজয় নিয়ামাহ level check
        async function checkBijoyNiamah(member, usersCollection) {
            // Get direct referrals (1st generation)
            const directReferrals = await usersCollection.find({
                referredBy: member.referralCode,
                payment: "paid"
            }).toArray();

            const paidDirectReferralsCount = directReferrals.length;

            // Calculate how many times the member qualifies for বিজয় নিয়ামাহ
            const qualifiedTimes = Math.floor(paidDirectReferralsCount / 13);

            if (qualifiedTimes > 0) {
                // Check current level to avoid duplicate rewards
                const currentLevel = member.leadershipLevel?.startsWith("বিজয় নিয়ামাহ") ?
                    parseInt(member.leadershipLevel.split(" ")[2] || "0") : 0;

                if (qualifiedTimes > currentLevel) {
                    // Update level and add reward
                    const newLevel = qualifiedTimes;
                    const rewardAmount = 700 * (qualifiedTimes - currentLevel);

                    await usersCollection.updateOne(
                        { _id: member._id },
                        {
                            $set: {
                                leadershipLevel: `বিজয় নিয়ামাহ ${newLevel}`,
                                "leadershipLevelReward": (member.leadershipLevelReward || 0) + rewardAmount
                            },
                            $inc: {
                                "wallet.leadershipFund": rewardAmount,
                                "wallet.main": rewardAmount
                            }
                        }
                    );

                    console.log(`Updated ${member.displayName} to বিজয় নিয়ামাহ ${newLevel} with ${rewardAmount} BDT reward`);
                }
            }
        }

        // বিজয় বারাকাহ level check
        async function checkBijoyBarakah(member, usersCollection) {
            // Get direct referrals (1st generation)
            const directReferrals = await usersCollection.find({
                referredBy: member.referralCode,
                payment: "paid"
            }).toArray();

            // Check if at least 3 direct referrals have বিজয় নিয়ামাহ level
            const qualifiedDirectReferrals = directReferrals.filter(ref =>
                ref.leadershipLevel?.startsWith("বিজয় নিয়ামাহ")
            ).length;

            if (qualifiedDirectReferrals >= 3) {
                // Check up to 10 generations for 2 more বিজয় নিয়ামাহ achievers
                const totalQualified = await countQualifiedInGenerations(member.referralCode, 10, "বিজয় নিয়ামাহ", usersCollection);

                if (totalQualified >= 2) {
                    // Calculate how many times qualified
                    const qualifiedTimes = Math.min(
                        Math.floor(qualifiedDirectReferrals / 3),
                        Math.floor(totalQualified / 2)
                    );

                    // Check current level to avoid duplicate rewards
                    const currentLevel = member.leadershipLevel?.startsWith("বিজয় বারাকাহ") ?
                        parseInt(member.leadershipLevel.split(" ")[2] || "0") : 0;

                    if (qualifiedTimes > currentLevel) {
                        // Update level and add reward
                        const newLevel = qualifiedTimes;
                        const rewardAmount = 2500 * (qualifiedTimes - currentLevel);

                        await usersCollection.updateOne(
                            { _id: member._id },
                            {
                                $set: {
                                    leadershipLevel: `বিজয় বারাকাহ ${newLevel}`,
                                    "leadershipLevelReward": (member.leadershipLevelReward || 0) + rewardAmount
                                },
                                $inc: {
                                    "wallet.leadershipFund": rewardAmount,
                                    "wallet.main": rewardAmount
                                }
                            }
                        );

                        console.log(`Updated ${member.displayName} to বিজয় বারাকাহ ${newLevel} with ${rewardAmount} BDT reward`);
                    }
                }
            }
        }

        // বিজয় আমানাহ level check
        async function checkBijoyAmanah(member, usersCollection) {
            // Get direct referrals (1st generation)
            const directReferrals = await usersCollection.find({
                referredBy: member.referralCode,
                payment: "paid"
            }).toArray();

            // Check if at least 3 direct referrals have বিজয় বারাকাহ level
            const qualifiedDirectReferrals = directReferrals.filter(ref =>
                ref.leadershipLevel?.startsWith("বিজয় বারাকাহ")
            ).length;

            if (qualifiedDirectReferrals >= 3) {
                // Check up to 10 generations for 3 more বিজয় বারাকাহ achievers
                const totalQualified = await countQualifiedInGenerations(member.referralCode, 10, "বিজয় বারাকাহ", usersCollection);

                if (totalQualified >= 3) {
                    // Calculate how many times qualified
                    const qualifiedTimes = Math.min(
                        Math.floor(qualifiedDirectReferrals / 3),
                        Math.floor(totalQualified / 3)
                    );

                    // Check current level to avoid duplicate rewards
                    const currentLevel = member.leadershipLevel?.startsWith("বিজয় আমানাহ") ?
                        parseInt(member.leadershipLevel.split(" ")[2] || "0") : 0;

                    if (qualifiedTimes > currentLevel) {
                        // Update level and add reward
                        const newLevel = qualifiedTimes;
                        const rewardAmount = 15000 * (qualifiedTimes - currentLevel);

                        await usersCollection.updateOne(
                            { _id: member._id },
                            {
                                $set: {
                                    leadershipLevel: `বিজয় আমানাহ ${newLevel}`,
                                    "leadershipLevelReward": (member.leadershipLevelReward || 0) + rewardAmount
                                },
                                $inc: {
                                    "wallet.leadershipFund": rewardAmount,
                                    "wallet.main": rewardAmount
                                }
                            }
                        );

                        console.log(`Updated ${member.displayName} to বিজয় আমানাহ ${newLevel} with ${rewardAmount} BDT reward`);
                    }
                }
            }
        }

        // বিজয় সালামাহ level check
        async function checkBijoySalamah(member, usersCollection) {
            // Get direct referrals (1st generation)
            const directReferrals = await usersCollection.find({
                referredBy: member.referralCode,
                payment: "paid"
            }).toArray();

            // Check if at least 4 direct referrals have বিজয় আমানাহ level
            const qualifiedDirectReferrals = directReferrals.filter(ref =>
                ref.leadershipLevel?.startsWith("বিজয় আমানাহ")
            ).length;

            if (qualifiedDirectReferrals >= 4) {
                // Check up to 10 generations for 3 more বিজয় আমানাহ achievers
                const totalQualified = await countQualifiedInGenerations(member.referralCode, 10, "বিজয় আমানাহ", usersCollection);

                if (totalQualified >= 3) {
                    // Calculate how many times qualified
                    const qualifiedTimes = Math.min(
                        Math.floor(qualifiedDirectReferrals / 4),
                        Math.floor(totalQualified / 3)
                    );

                    // Check current level to avoid duplicate rewards
                    const currentLevel = member.leadershipLevel?.startsWith("বিজয় সালামাহ") ?
                        parseInt(member.leadershipLevel.split(" ")[2] || "0") : 0;

                    if (qualifiedTimes > currentLevel) {
                        // Update level and add reward
                        const newLevel = qualifiedTimes;
                        const rewardAmount = 60000 * (qualifiedTimes - currentLevel);

                        await usersCollection.updateOne(
                            { _id: member._id },
                            {
                                $set: {
                                    leadershipLevel: `বিজয় সালামাহ ${newLevel}`,
                                    "leadershipLevelReward": (member.leadershipLevelReward || 0) + rewardAmount
                                },
                                $inc: {
                                    "wallet.leadershipFund": rewardAmount,
                                    "wallet.main": rewardAmount
                                }
                            }
                        );

                        console.log(`Updated ${member.displayName} to বিজয় সালামাহ ${newLevel} with ${rewardAmount} BDT reward`);
                    }
                }
            }
        }

        // বিজয় রাহবার level check
        async function checkBijoyRahbar(member, usersCollection) {
            // Get direct referrals (1st generation)
            const directReferrals = await usersCollection.find({
                referredBy: member.referralCode,
                payment: "paid"
            }).toArray();

            // Check if at least 4 direct referrals have বিজয় সালামাহ level
            const qualifiedDirectReferrals = directReferrals.filter(ref =>
                ref.leadershipLevel?.startsWith("বিজয় সালামাহ")
            ).length;

            if (qualifiedDirectReferrals >= 4) {
                // Check up to 10 generations for 3 more বিজয় সালামাহ achievers
                const totalQualified = await countQualifiedInGenerations(member.referralCode, 10, "বিজয় সালামাহ", usersCollection);

                if (totalQualified >= 3) {
                    // Calculate how many times qualified
                    const qualifiedTimes = Math.min(
                        Math.floor(qualifiedDirectReferrals / 4),
                        Math.floor(totalQualified / 3)
                    );

                    // Check current level to avoid duplicate rewards
                    const currentLevel = member.leadershipLevel?.startsWith("বিজয় রাহবার") ?
                        parseInt(member.leadershipLevel.split(" ")[2] || "0") : 0;

                    if (qualifiedTimes > currentLevel) {
                        // Update level and add reward
                        const newLevel = qualifiedTimes;
                        const rewardAmount = 500000 * (qualifiedTimes - currentLevel);

                        await usersCollection.updateOne(
                            { _id: member._id },
                            {
                                $set: {
                                    leadershipLevel: `বিজয় রাহবার ${newLevel}`,
                                    "leadershipLevelReward": (member.leadershipLevelReward || 0) + rewardAmount
                                },
                                $inc: {
                                    "wallet.leadershipFund": rewardAmount,
                                    "wallet.main": rewardAmount
                                }
                            }
                        );

                        console.log(`Updated ${member.displayName} to বিজয় রাহবার ${newLevel} with ${rewardAmount} BDT reward`);
                    }
                }
            }
        }

        // Helper function to count qualified members in up to N generations
        async function countQualifiedInGenerations(startReferralCode, maxGenerations, targetLevel, usersCollection) {
            let count = 0;
            let currentGeneration = [startReferralCode];

            for (let gen = 1; gen <= maxGenerations; gen++) {
                const nextGeneration = [];

                // Find all users referred by current generation
                const users = await usersCollection.find({
                    referredBy: { $in: currentGeneration },
                    payment: "paid"
                }).toArray();

                // Add to next generation
                for (const user of users) {
                    nextGeneration.push(user.referralCode);

                    // Check if user has the target level
                    if (user.leadershipLevel?.startsWith(targetLevel)) {
                        count++;
                    }
                }

                if (nextGeneration.length === 0) break;
                currentGeneration = nextGeneration;
            }

            return count;
        }

        // Start monitoring every 5 seconds
        setInterval(monitorLeadershipLevels, 10000);

        // Initial run
        monitorLeadershipLevels();





        const monitorWalletFields = async () => {
            try {
                const wallets = await usersWallets.find({}).toArray();
                let updated = 0;

                for (const wallet of wallets) {
                    const updateFields = {};

                    if (wallet.earningBalance === undefined) updateFields.earningBalance = 0;
                    if (wallet.totalBalance === undefined) updateFields.totalBalance = 0;
                    if (wallet.withdrawalBalance === undefined) updateFields.withdrawalBalance = 0;
                    if (wallet.refererBalance === undefined) updateFields.refererBalance = 0;
                    if (wallet.microJobEarning === undefined) updateFields.microJobEarning = 0;

                    if (Object.keys(updateFields).length > 0) {
                        await usersWallets.updateOne(
                            { _id: wallet._id },
                            { $set: updateFields }
                        );
                        updated++;
                    }
                }

                console.log(`✅ monitorWalletFields done. Total updated wallets: ${updated}`);
            } catch (err) {
                console.error("❌ Error in monitorWalletFields:", err.message);
            }
        };
        setInterval(() => {
            monitorWalletFields();
        }, 1 * 60 * 1000);


        setInterval(() => {
            monitorReferralBonuses();

        }, 10 * 1000); // প্রতি ১০ সেকেন্ডে একবার চালাবে















        // Add product
        app.post('/api/products', async (req, res) => {
            try {
                const productData = req.body;

                if (!productData.productName || !productData.mainCategory || !productData.description) {
                    return res.status(400).json({
                        success: false,
                        message: 'Product name, category, and description are required'
                    });
                }

                productData.createdAt = new Date();
                productData.updatedAt = new Date();

                const result = await productsCollection.insertOne(productData);

                res.status(201).json({
                    success: true,
                    message: 'Product created successfully',
                    productId: result.insertedId
                });
            } catch (error) {
                console.error('Error creating product:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: error.message
                });
            }
        });

        // Get products with pagination
        app.get('/api/products', async (req, res) => {
            try {
                const limit = parseInt(req.query.limit) || 10;
                const skip = parseInt(req.query.skip) || 0;

                const products = await productsCollection.find()
                    .skip(skip)
                    .limit(limit)
                    .toArray();

                const total = await productsCollection.countDocuments();

                res.status(200).json({
                    success: true,
                    products,
                    total
                });
            } catch (error) {
                console.error('Error fetching products:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error'
                });
            }
        });


        app.get('/api/products/:id', async (req, res) => {
            try {
                const productId = req.params.id;

                if (!ObjectId.isValid(productId)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid product ID format'
                    });
                }

                const product = await productsCollection.findOne({ _id: new ObjectId(productId) });

                if (!product) {
                    return res.status(404).json({
                        success: false,
                        message: 'Product not found'
                    });
                }

                res.status(200).json({
                    success: true,
                    product
                });
            } catch (error) {
                console.error('Error fetching product:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error'
                });
            }
        });

        // Cart API Routes
        app.post('/api/carts', async (req, res) => {
            try {
                const { userId, productId, quantity, variant } = req.body;

                // Validate input
                if (!userId || !productId || !quantity) {
                    return res.status(400).json({
                        success: false,
                        message: 'userId, productId and quantity are required'
                    });
                }

                // Check if product already exists in cart
                const existingCartItem = await cartsCollection.findOne({
                    userId,
                    productId,
                    'variant.type': variant?.type || null,
                    'variant.value': variant?.value || null
                });

                if (existingCartItem) {
                    // Update quantity if already exists
                    const result = await cartsCollection.updateOne(
                        { _id: existingCartItem._id },
                        { $set: { quantity: existingCartItem.quantity + quantity } }
                    );

                    return res.status(200).json({
                        success: true,
                        message: 'Cart item quantity updated',
                        cartItem: { ...existingCartItem, quantity: existingCartItem.quantity + quantity }
                    });
                }

                // Create new cart item
                const cartItem = {
                    userId,
                    productId,
                    quantity,
                    variant: variant || null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                const result = await cartsCollection.insertOne(cartItem);

                res.status(201).json({
                    success: true,
                    message: 'Product added to cart',
                    cartItem: { _id: result.insertedId, ...cartItem }
                });
            } catch (error) {
                console.error('Error adding to cart:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to add to cart',
                    error: error.message
                });
            }
        });

        // Check if product is in cart with variant matching
        app.get('/api/carts/check/:userId/:productId', async (req, res) => {
            try {
                const { userId, productId } = req.params;
                const { variantType, variantValue } = req.query;

                const query = {
                    userId,
                    productId
                };

                if (variantType && variantValue) {
                    query['variant.type'] = variantType;
                    query['variant.value'] = variantValue;
                }

                const cartItem = await cartsCollection.findOne(query);

                res.status(200).json({
                    success: true,
                    isInCart: !!cartItem,
                    cartItemId: cartItem?._id || null
                });
            } catch (error) {
                console.error('Error checking cart:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to check cart status',
                    error: error.message
                });
            }
        });

        app.get('/api/carts/:userId', async (req, res) => {
            try {
                const { userId } = req.params;

                const cartItems = await cartsCollection.aggregate([
                    { $match: { userId } },
                    {
                        $addFields: {
                            productIdObj: { $toObjectId: '$productId' }
                        }
                    },
                    {
                        $lookup: {
                            from: 'products',
                            localField: 'productIdObj',
                            foreignField: '_id',
                            as: 'product'
                        }
                    },
                    { $unwind: '$product' },
                    {
                        $project: {
                            _id: 1,
                            userId: 1,
                            quantity: 1,
                            variant: 1,
                            createdAt: 1,
                            updatedAt: 1,
                            product: "$product" // ✅ পুরো product অবজেক্ট নিচ্ছে
                        }
                    }
                ]).toArray();


                res.status(200).json({
                    success: true,
                    cartItems
                });
            } catch (error) {
                console.error('Error fetching cart:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch cart',
                    error: error.message
                });
            }
        });

        // Update cart item quantity
        app.put('/api/carts/:cartItemId', async (req, res) => {
            try {
                const { cartItemId } = req.params;
                const { quantity } = req.body;

                if (!quantity || quantity < 1) {
                    return res.status(400).json({
                        success: false,
                        message: 'Quantity must be at least 1'
                    });
                }

                const result = await cartsCollection.updateOne(
                    { _id: new ObjectId(cartItemId) },
                    { $set: { quantity, updatedAt: new Date() } }
                );

                if (result.modifiedCount === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'Cart item not found'
                    });
                }

                res.status(200).json({
                    success: true,
                    message: 'Cart item updated'
                });
            } catch (error) {
                console.error('Error updating cart:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to update cart',
                    error: error.message
                });
            }
        });

        // Remove item from cart
        app.delete('/api/carts/:cartItemId', async (req, res) => {
            try {
                const { cartItemId } = req.params;

                const result = await cartsCollection.deleteOne({ _id: new ObjectId(cartItemId) });

                if (result.deletedCount === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'Cart item not found'
                    });
                }

                res.status(200).json({
                    success: true,
                    message: 'Item removed from cart'
                });
            } catch (error) {
                console.error('Error removing from cart:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to remove from cart',
                    error: error.message
                });
            }
        });


        // Favorites API Routes
        app.post('/api/favorites', async (req, res) => {
            try {
                const { userId, productId } = req.body;

                if (!userId || !productId) {
                    return res.status(400).json({
                        success: false,
                        message: 'userId and productId are required'
                    });
                }

                // Check if already favorited
                const existingFavorite = await favoritesCollection.findOne({ userId, productId });

                if (existingFavorite) {
                    return res.status(400).json({
                        success: false,
                        message: 'Product already in favorites'
                    });
                }

                const favorite = {
                    userId,
                    productId,
                    createdAt: new Date()
                };

                const result = await favoritesCollection.insertOne(favorite);

                res.status(201).json({
                    success: true,
                    message: 'Product added to favorites',
                    favorite: { _id: result.insertedId, ...favorite }
                });
            } catch (error) {
                console.error('Error adding to favorites:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to add to favorites',
                    error: error.message
                });
            }
        });


        app.get('/api/favorites/:userId', async (req, res) => {
            try {
                const { userId } = req.params;
                const page = parseInt(req.query.page) || 1; // Default page 1
                const limit = parseInt(req.query.limit) || 10; // Default 10 per page
                const skip = (page - 1) * limit;

                const favorites = await favoritesCollection.aggregate([
                    { $match: { userId } },
                    {
                        $addFields: {
                            productObjId: { $toObjectId: "$productId" }
                        }
                    },
                    {
                        $lookup: {
                            from: 'products',
                            localField: 'productObjId',
                            foreignField: '_id',
                            as: 'product'
                        }
                    },
                    { $unwind: '$product' },
                    { $skip: skip },
                    { $limit: limit }
                ]).toArray();

                const total = await favoritesCollection.countDocuments({ userId });

                res.status(200).json({
                    success: true,
                    favorites,
                    total
                });
            } catch (error) {
                console.error('Error fetching favorites:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch favorites',
                    error: error.message
                });
            }
        });

        // Remove from favorites
        app.delete('/api/favorites/:favoriteId', async (req, res) => {
            try {
                const { favoriteId } = req.params;

                const result = await favoritesCollection.deleteOne({ _id: new ObjectId(favoriteId) });

                if (result.deletedCount === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'Favorite item not found'
                    });
                }

                res.status(200).json({
                    success: true,
                    message: 'Removed from favorites'
                });
            } catch (error) {
                console.error('Error removing from favorites:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to remove from favorites',
                    error: error.message
                });
            }
        });

        // Check if product is in favorites
        app.get('/api/favorites/check/:userId/:productId', async (req, res) => {
            try {
                const { userId, productId } = req.params;

                const favorite = await favoritesCollection.findOne({ userId, productId });

                res.status(200).json({
                    success: true,
                    isFavorite: !!favorite,
                    favoriteId: favorite?._id || null  // এই লাইনটাই দরকার
                });
            } catch (error) {
                console.error('Error checking favorite:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to check favorite status',
                    error: error.message
                });
            }
        });

        // GET reviews by product with pagination
        app.get('/api/reviews', async (req, res) => {
            const { productId, page = 1, limit = 10 } = req.query;
            const skip = (page - 1) * limit;

            try {
                const reviews = await reviewsCollection
                    .find({ productId })
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(parseInt(limit))
                    .toArray();

                const totalReviews = await reviewsCollection.countDocuments({ productId });
                const totalPages = Math.ceil(totalReviews / limit);

                res.json({
                    reviews,
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages,
                        totalReviews,
                        hasNextPage: page < totalPages,
                        hasPrevPage: page > 1
                    }
                });
            } catch (error) {
                res.status(500).json({ error: 'Failed to fetch reviews' });
            }
        });

        // POST new review
        app.post('/api/reviews', async (req, res) => {
            const review = {
                ...req.body,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const result = await reviewsCollection.insertOne(review);
            res.status(201).json({ _id: result.insertedId, ...review });
        });

        // PUT update review
        app.put('/api/reviews/:id', async (req, res) => {
            const id = req.params.id;
            const updateDoc = {
                $set: {
                    ...req.body,
                    updatedAt: new Date()
                }
            };
            await reviewsCollection.updateOne({ _id: new ObjectId(id) }, updateDoc);
            const updated = await reviewsCollection.findOne({ _id: new ObjectId(id) });
            res.json(updated);
        });
        // DELETE review
        app.delete('/api/reviews/:id', async (req, res) => {
            const id = req.params.id;
            await reviewsCollection.deleteOne({ _id: new ObjectId(id) });
            res.json({ success: true });
        });
        //!products api end
        app.post("/api/update-name", async (req, res) => {
            const { firebaseUID, name, age, gender, profession, photoURL } = req.body;

            if (!firebaseUID || !name) {
                return res.status(400).json({ message: "firebaseUID and name required" });
            }

            try {
                const updateFields = {
                    displayName: name,
                };

                if (age) updateFields.age = parseInt(age);
                if (gender) updateFields.gender = gender;
                if (profession) updateFields.profession = profession;
                if (photoURL) updateFields.photoURL = photoURL;

                const result = await usersCollection.updateOne(
                    { firebaseUID },
                    { $set: updateFields },
                    { upsert: true }
                );

                res.json({ message: "Profile updated successfully" });
            } catch (error) {
                console.error("Update error:", error);
                res.status(500).json({ message: "Internal server error" });
            }
        });

        app.post("/api/nid-upload", async (req, res) => {
            try {
                const { firebaseUID, nidFront, nidBack } = req.body;

                if (!firebaseUID || !nidFront || !nidBack) {
                    return res.status(400).json({ message: "All fields are required." });
                }

                const nidDocuments = [
                    { type: "nid-front", url: nidFront },
                    { type: "nid-back", url: nidBack }
                ];

                const result = await usersCollection.updateOne(
                    { firebaseUID },
                    {
                        $push: {
                            "kyc.documents": { $each: nidDocuments }
                        }
                    },
                    { upsert: true }
                );

                res.json({ message: "NID documents saved under kyc.documents successfully." });
            } catch (error) {
                console.error("NID upload error:", error);
                res.status(500).json({ message: "Internal server error" });
            }
        });

        app.put("/api/users/address/:uid", async (req, res) => {
            const uid = req.params.uid;
            const { division, district, area, addressLine, postalCode } = req.body;

            if (!uid || !division || !district || !area || !addressLine || !postalCode) {
                return res.status(400).json({
                    success: false,
                    message: "All address fields are required."
                });
            }

            try {
                const result = await usersCollection.updateOne(
                    { firebaseUID: uid },
                    {
                        $set: {
                            address: {
                                division,
                                district,
                                area,
                                addressLine,
                                postalCode,
                                updatedAt: new Date()
                            }
                        }
                    },
                    { upsert: false }
                );

                if (result.modifiedCount === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "User not found or no changes made."
                    });
                }

                res.status(200).json({
                    success: true,
                    message: "Address updated successfully."
                });
            } catch (error) {
                console.error("Error updating address:", error);
                res.status(500).json({
                    success: false,
                    message: "Internal server error"
                });
            }
        });
        // GET: Get user by Firebase UID
        app.get('/users/by-uid/:uid', async (req, res) => {
            try {
                const uid = req.params.uid;
                const user = await usersCollection.findOne({ firebaseUID: uid });

                if (!user) {
                    return res.status(404).json({
                        success: false,
                        message: 'User not found'
                    });
                }

                res.status(200).json({
                    success: true,
                    user
                });
            } catch (error) {
                console.error('Error fetching user by UID:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error'
                });
            }
        });
        // API to check if referral code exists
        app.get('/users/check-referral/:code', async (req, res) => {
            try {
                const code = req.params.code;
                const user = await usersCollection.findOne({ referralCode: code });

                res.status(200).json({
                    exists: !!user,
                    valid: user ? true : false
                });
            } catch (error) {
                console.error('Error checking referral code:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error'
                });
            }
        });
        // API to create new user
        app.post('/users', async (req, res) => {
            try {
                const userData = req.body;

                // Check if email already exists
                const existingEmail = await usersCollection.findOne({ email: userData.email });
                if (existingEmail) {
                    return res.status(400).json({
                        success: false,
                        message: 'Email already exists',
                        field: 'email'
                    });
                }

                // Check if phone already exists
                const existingPhone = await usersCollection.findOne({ phone: userData.phone });
                if (existingPhone) {
                    return res.status(400).json({
                        success: false,
                        message: 'Phone number already exists',
                        field: 'phone'
                    });
                }

                // Check if referral code already exists
                if (userData.referralCode) {
                    const existingReferral = await usersCollection.findOne({ referralCode: userData.referralCode });
                    if (existingReferral) {
                        return res.status(400).json({
                            success: false,
                            message: 'Referral code already exists',
                            field: 'referralCode'
                        });
                    }
                }

                // Insert new user
                const result = await usersCollection.insertOne(userData);

                res.status(201).json({
                    success: true,
                    message: 'User created successfully',
                    userId: result.insertedId
                });
            } catch (error) {
                console.error('Error creating user:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: error.message
                });
            }
        });

        // Wallet API Route
        app.post('/api/create-wallet', async (req, res) => {
            try {
                const { uid } = req.body;

                // Validate the UID
                if (!uid) {
                    return res.status(400).json({
                        success: false,
                        message: 'User ID (uid) is required'
                    });
                }

                // Check if wallet already exists for this user
                const existingWallet = await usersWallets.findOne({ uid });
                if (existingWallet) {
                    return res.status(400).json({
                        success: false,
                        message: 'Wallet already exists for this user'
                    });
                }

                // Create new wallet document
                const walletData = {
                    uid,
                    createdAt: new Date(),
                    earningBalance: 0,
                    totalBalance: 0,
                    withdrawalBalance: 0


                };

                // Insert the wallet
                const result = await usersWallets.insertOne(walletData);

                res.status(201).json({
                    success: true,
                    message: 'Wallet created successfully',
                    walletId: result.insertedId
                });
            } catch (error) {
                console.error('Error creating wallet:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: error.message
                });
            }
        });

        // API to update user verification status
        app.patch('/users/verify-user', async (req, res) => {
            try {
                const { email, verificationMethod, isVerified } = req.body;

                let updateField = {};
                if (verificationMethod === 'email') {
                    updateField = { emailVerified: isVerified };
                } else if (verificationMethod === 'phone') {
                    updateField = { isOtpVerified: isVerified };
                }

                const result = await usersCollection.updateOne(
                    { email: email },
                    { $set: updateField }
                );

                if (result.modifiedCount === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'User not found or no changes made'
                    });
                }

                res.status(200).json({
                    success: true,
                    message: 'User verification status updated successfully'
                });
            } catch (error) {
                console.error('Error updating user verification status:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: error.message
                });
            }
        });
        // API to check if phone number exists
        app.post('/users/check-phone', async (req, res) => {
            try {
                const { phone } = req.body;
                const existingUser = await usersCollection.findOne({ phone });

                res.status(200).json({
                    exists: !!existingUser
                });
            } catch (error) {
                console.error('Error checking phone number:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error'
                });
            }
        });

        // API to find user by phone number (flexible format)
        app.post('/users/find-by-phone', async (req, res) => {
            try {
                const { phone } = req.body;

                // First try to find with exact phone number
                let user = await usersCollection.findOne({ phone });

                // If not found, try to normalize and find again
                if (!user) {
                    // Remove all non-digit characters
                    const digitsOnly = phone.replace(/\D/g, '');

                    // Try with +880 prefix
                    if (digitsOnly.startsWith('880')) {
                        user = await usersCollection.findOne({
                            $or: [
                                { phone: `+${digitsOnly}` },
                                { phone: `0${digitsOnly.substring(3)}` }
                            ]
                        });
                    }
                    // Try with 0 prefix (local format)
                    else if (digitsOnly.startsWith('0')) {
                        user = await usersCollection.findOne({
                            $or: [
                                { phone: digitsOnly },
                                { phone: `+880${digitsOnly.substring(1)}` }
                            ]
                        });
                    }
                    // Try with 11 digits (assuming Bangladesh number without prefix)
                    else if (digitsOnly.length === 11) {
                        user = await usersCollection.findOne({
                            $or: [
                                { phone: `0${digitsOnly}` },
                                { phone: `+880${digitsOnly}` }
                            ]
                        });
                    }
                }

                if (user) {
                    res.status(200).json({
                        exists: true,
                        user: {
                            email: user.email,
                            phone: user.phone
                        }
                    });
                } else {
                    res.status(200).json({
                        exists: false
                    });
                }
            } catch (error) {
                console.error('Error finding user by phone:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error'
                });
            }
        });
        // New endpoint to send OTP for password reset
        app.post('/auth/send-reset-otp', async (req, res) => {
            try {
                const { phone } = req.body;

                // Find user by phone (with normalization)
                const digitsOnly = phone.replace(/\D/g, '');
                const normalizedPhone = digitsOnly.startsWith('880') ? `+${digitsOnly}` :
                    digitsOnly.startsWith('0') ? `+880${digitsOnly.substring(1)}` :
                        digitsOnly.length === 11 ? `+880${digitsOnly}` :
                            `+${digitsOnly}`;

                const user = await usersCollection.findOne({
                    $or: [
                        { phone: normalizedPhone },
                        { phone: phone } // Also check original in case it's already normalized
                    ]
                });

                if (!user) {
                    return res.status(404).json({
                        success: false,
                        message: 'No account found with this phone number'
                    });
                }

                // Generate 6-digit OTP
                const otp = Math.floor(100000 + Math.random() * 900000).toString();
                const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration

                // Store OTP in database
                await otpCollection.insertOne({
                    phone: normalizedPhone,
                    otp,
                    expiresAt,
                    used: false,
                    createdAt: new Date()
                });

                // Send OTP via SMS
                const message = `Your password reset OTP is: ${otp}. This OTP will expire in 5 minutes.`;
                const smsResponse = await axios.get(SMS_API_URL, {
                    params: {
                        api_key: SMS_API_KEY,
                        type: 'text',
                        number: normalizedPhone.replace('+', ''),
                        senderid: SMS_SENDER_ID,
                        message: message
                    }
                });

                res.status(200).json({
                    success: true,
                    message: 'OTP sent successfully',
                    phone: normalizedPhone
                });
            } catch (error) {
                console.error('Error sending OTP:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to send OTP',
                    error: error.message
                });
            }
        });
        // New endpoint to verify OTP and reset password
        app.post('/auth/reset-password-with-otp', async (req, res) => {
            try {
                const { phone, otp, newPassword } = req.body;

                // Find the OTP record
                const otpRecord = await otpCollection.findOne({
                    phone,
                    otp,
                    used: false,
                    expiresAt: { $gt: new Date() }
                });

                if (!otpRecord) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid or expired OTP'
                    });
                }

                // Find the user
                const user = await usersCollection.findOne({ phone });
                if (!user) {
                    return res.status(404).json({
                        success: false,
                        message: 'User not found'
                    });
                }

                // Update password in Firebase
                await admin.auth().updateUser(user.firebaseUID, {
                    password: newPassword
                });

                // Mark OTP as used
                await otpCollection.updateOne(
                    { _id: otpRecord._id },
                    { $set: { used: true } }
                );

                res.status(200).json({
                    success: true,
                    message: 'Password reset successfully'
                });
            } catch (error) {
                console.error('Error resetting password:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to reset password',
                    error: error.message
                });
            }
        });
        // Add this to your backend (server.js)
        app.post('/api/send-otp', async (req, res) => {
            try {
                const { phoneNumber } = req.body;

                // Generate 6-digit OTP
                const otp = Math.floor(100000 + Math.random() * 900000).toString();
                const message = `Your bijoy-313 verification OTP is: ${otp}`;

                // Send OTP via SMS
                const response = await axios.get('http://bulksmsbd.net/api/smsapi', {
                    params: {
                        api_key: 'bFmnZedJjsrnK1pL9LZU',
                        type: 'text',
                        number: phoneNumber.replace('+', ''),
                        senderid: '8809617627038',
                        message: message
                    }
                });

                // Save OTP to database (optional for verification)
                await otpCollection.insertOne({
                    phone: phoneNumber,
                    otp,
                    createdAt: new Date(),
                    expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes expiry
                });

                res.status(200).json({
                    success: true,
                    message: 'OTP sent successfully',
                    otp: otp // For development only, remove in production
                });
            } catch (error) {
                console.error('Error sending OTP:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to send OTP'
                });
            }
        });


        // Add this to your backend (server.js)
        app.post('/api/verify-otp', async (req, res) => {
            try {
                const { phoneNumber, otp } = req.body;

                // Check OTP from database
                const otpRecord = await otpCollection.findOne({
                    phone: phoneNumber,
                    otp,
                    expiresAt: { $gt: new Date() }
                });

                if (!otpRecord) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid or expired OTP'
                    });
                }

                // Mark OTP as used (optional)
                await otpCollection.updateOne(
                    { _id: otpRecord._id },
                    { $set: { used: true } }
                );

                res.status(200).json({
                    success: true,
                    message: 'OTP verified successfully'
                });
            } catch (error) {
                console.error('Error verifying OTP:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to verify OTP'
                });
            }
        });
        // Add new active job
        app.post('/api/active-jobs', async (req, res) => {
            try {
                const { quantity, note, token, serviceType, unitPrice, totalPrice, status } = req.body;

                // Verify Firebase ID token
                const decodedToken = await admin.auth().verifyIdToken(token);
                const uid = decodedToken.uid;

                // Basic validation
                if (!quantity || quantity < 1) {
                    return res.status(400).json({ success: false, message: 'Quantity is required and must be at least 1' });
                }

                // Prepare job data
                const jobData = {
                    uid,
                    quantity,
                    note: note || '',
                    serviceType: serviceType || 'Unknown',
                    status: status,
                    unitPrice: parseFloat(unitPrice) || 0,
                    totalPrice: parseFloat(totalPrice) || 0,
                    createdAt: new Date()
                };

                const result = await activeJobsCollection.insertOne(jobData);

                res.status(201).json({
                    success: true,
                    message: 'Active job submitted successfully',
                    jobId: result.insertedId
                });
            } catch (error) {
                console.error('Error submitting active job:', error);
                res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
            }
        });
        // server.js বা routes ফাইলে
        app.get('/api/active-jobs', async (req, res) => {
            try {
                const jobs = await activeJobsCollection.find().sort({ createdAt: -1 }).toArray();

                res.status(200).json({
                    success: true,
                    data: jobs
                });
            } catch (error) {
                console.error('Error fetching active jobs:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: error.message
                });
            }
        });

        // Update job status by ID
        app.put('/api/active-jobs/:id/status', async (req, res) => {
            const { id } = req.params;
            const { status } = req.body;

            if (!status || typeof status !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status provided'
                });
            }

            try {
                const result = await activeJobsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status } }
                );

                if (result.modifiedCount === 1) {
                    return res.status(200).json({
                        success: true,
                        message: `Job status updated to ${status}`
                    });
                } else {
                    return res.status(404).json({
                        success: false,
                        message: 'Job not found or already has that status'
                    });
                }
            } catch (error) {
                console.error('Error updating job status:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: error.message
                });
            }
        });
        app.put('/api/active-jobs/bulk-status', async (req, res) => {
            try {
                const { jobIds, status } = req.body;

                if (!Array.isArray(jobIds) || typeof status !== 'string') {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid jobIds or status'
                    });
                }

                const objectIds = jobIds.map(id => new ObjectId(id));

                const result = await activeJobsCollection.updateMany(
                    { _id: { $in: objectIds } },
                    { $set: { status } }
                );

                res.json({
                    success: true,
                    updatedCount: result.modifiedCount,
                    message: `${result.modifiedCount} jobs updated successfully`
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: error.message
                });
            }
        });
        app.post("/api/active-job-reports", async (req, res) => {
            const { jobId, uid, reasons, balance } = req.body;

            if (!jobId || !uid || !Array.isArray(reasons) || reasons.length === 0) {
                return res.status(400).json({ success: false, message: "Missing or invalid fields" });
            }

            const isValidReasons = reasons.every(
                (r) => r.heading && typeof r.heading === "string" && r.explanation && typeof r.explanation === "string"
            );

            if (!isValidReasons) {
                return res.status(400).json({ success: false, message: "Invalid reason format" });
            }

            try {
                const reportDoc = {
                    jobId,
                    uid,
                    reasons,
                    createdAt: new Date()
                };

                if (typeof balance === "number" && balance >= 0) {
                    reportDoc.balance = balance;
                }

                const result = await activeJobReportCollection.insertOne(reportDoc);

                res.json({ success: true, message: "Report submitted", insertedId: result.insertedId });
            } catch (error) {
                console.error("Error saving report:", error);
                res.status(500).json({ success: false, message: "Server error", error: error.message });
            }
        });



        // Get all active jobs for a specific user by uid
        app.get('/api/active-jobs/:uid', async (req, res) => {
            const { uid } = req.params;

            if (!uid) {
                return res.status(400).json({
                    success: false,
                    message: 'UID is required'
                });
            }

            try {
                const jobs = await activeJobsCollection
                    .find({ uid })
                    .sort({ createdAt: -1 })
                    .toArray();

                res.status(200).json({
                    success: true,
                    data: jobs
                });
            } catch (error) {
                console.error('Error fetching user-specific jobs:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: error.message
                });
            }
        });
        app.get('/api/active-jobs-reports/:uid', async (req, res) => {
            const { uid } = req.params;

            if (!uid) {
                return res.status(400).json({
                    success: false,
                    message: 'UID is required'
                });
            }

            try {
                const jobs = await activeJobReportCollection
                    .find({ uid })
                    .sort({ createdAt: -1 })
                    .toArray();

                res.status(200).json({
                    success: true,
                    data: jobs
                });
            } catch (error) {
                console.error('Error fetching user-specific jobs:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: error.message
                });
            }
        });
        // ✅ Check if job already exists in user_completed_works
        app.get('/api/user-completed-works/by-job-id/:jobId', async (req, res) => {
            try {
                const { jobId } = req.params;

                if (!jobId) {
                    return res.status(400).json({
                        success: false,
                        message: "Job ID is required"
                    });
                }

                const existing = await userCompleteTask.findOne({ jobId });

                if (existing) {
                    return res.status(200).json({
                        success: true,
                        message: "Job already exists in completed works",
                        completedWork: existing
                    });
                } else {
                    return res.status(200).json({
                        success: false,
                        message: "No completed work found with this jobId"
                    });
                }
            } catch (error) {
                console.error("Error checking completed work:", error);
                res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: error.message
                });
            }
        });


        // user_completed_works এর জন্য API রুট
        app.post('/api/user-completed-works', async (req, res) => {
            try {
                const { uid, jobId, remainingBalance, jobDetails } = req.body;

                // ভ্যালিডেশন
                if (!uid || !jobId || remainingBalance === undefined) {
                    return res.status(400).json({
                        success: false,
                        message: 'UID, Job ID and Remaining Balance are required'
                    });
                }

                const completedWork = {
                    uid,
                    jobId,
                    remainingBalance,
                    jobDetails,
                    status: 'pending', // অথবা আপনার প্রয়োজন অনুযায়ী অন্য কোনো স্ট্যাটাস
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                const result = await userCompleteTask.insertOne(completedWork);

                res.status(201).json({
                    success: true,
                    message: 'Completed work record created successfully',
                    data: result.insertedId
                });
            } catch (error) {
                console.error('Error creating completed work record:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: error.message
                });
            }
        });
        // Add this route in your backend
        app.put('/api/wallets/update-balance', async (req, res) => {
            try {
                const { uid, amount } = req.body;

                // ভ্যালিডেশন
                if (!uid || amount === undefined || amount === null) {
                    return res.status(400).json({
                        success: false,
                        message: 'UID and amount are required'
                    });
                }

                // ডকুমেন্ট exists কিনা চেক
                const existingWallet = await usersWallets.findOne({ uid });

                if (existingWallet) {
                    // নতুন ব্যালেন্স ক্যালকুলেশন
                    const newActiveJobEarning = (existingWallet.activeJobEarning || 0) + amount;

                    const updateFields = {
                        $inc: { totalBalance: amount },
                        $set: { activeJobEarning: newActiveJobEarning }
                    };

                    const result = await usersWallets.findOneAndUpdate(
                        { uid },
                        updateFields,
                        { returnDocument: 'after' }
                    );

                    return res.status(200).json({
                        success: true,
                        message: 'Wallet updated successfully',
                        wallet: result.value
                    });
                } else {
                    // নতুন ওয়ালেট তৈরি
                    const newWallet = {
                        uid,
                        totalBalance: amount,
                        withdrawalBalance: 0,
                        activeJobEarning: amount,
                        createdAt: new Date()
                    };

                    const result = await usersWallets.insertOne(newWallet);

                    return res.status(200).json({
                        success: true,
                        message: 'Wallet created successfully',
                        wallet: { ...newWallet, _id: result.insertedId }
                    });
                }
            } catch (error) {
                console.error('❌ Error updating wallet:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: error.message
                });
            }
        });



        // Wallet API Routes
        app.get('/api/wallets/balance/:uid', async (req, res) => {
            try {
                const { uid } = req.params;

                if (!uid) {
                    return res.status(400).json({
                        success: false,
                        message: 'UID is required'
                    });
                }

                const wallet = await usersWallets.findOne({ uid });

                if (!wallet) {
                    return res.status(404).json({
                        success: false,
                        message: 'Wallet not found for this user',
                        balance: 0,
                        totalBalance: 0,
                        withdrawalBalance: 0
                    });
                }

                res.status(200).json({
                    success: true,
                    message: 'Wallet balance retrieved successfully',
                    balance: Number(wallet.earningBalance || 0),
                    totalBalance: Number(wallet.totalBalance || 0),
                    withdrawalBalance: Number(wallet.withdrawalBalance || 0)
                });
            } catch (error) {
                console.error('Error fetching wallet balance:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: error.message
                });
            }
        });
        //!?????????????????????????????
        // Show all active job payment reports
        app.get('/api/active-paid-users', async (req, res) => {
            try {
                const reports = await activeJobPymentReport.find().toArray();
                res.status(200).json(reports);
            } catch (error) {
                console.error('Error fetching active paid users:', error);
                res.status(500).json({ message: 'Internal server error' });
            }
        });
        app.get('/api/paid-users/details', async (req, res) => {
            try {
                const reports = await activeJobPymentReport.find().toArray();

                const firebaseUIDs = reports.map(r => r.uid);

                // Get users that match those firebaseUIDs
                const matchedUsers = await usersCollection.find({
                    firebaseUID: { $in: firebaseUIDs }
                }).toArray();

                // Map uid with user info
                const result = reports.map(report => {
                    const matchedUser = matchedUsers.find(user => user.firebaseUID === report.uid);
                    return {
                        uid: report.uid,
                        paymentMethod: report.paymentMethod,
                        transactionId: report.transactionId,
                        senderPhone: report.senderPhone,
                        createdAt: report.createdAt,
                        userInfo: matchedUser ? {
                            displayName: matchedUser.displayName,
                            email: matchedUser.email,
                            phone: matchedUser.phone,
                            payment: matchedUser.payment,
                            _id: matchedUser._id
                        } : null
                    };
                });

                res.status(200).json(result);
            } catch (error) {
                console.error("Error fetching user payment info:", error);
                res.status(500).json({ message: "Internal Server Error" });
            }
        });
        app.patch('/api/users/update-payment/:id', async (req, res) => {
            const id = req.params.id;
            const { payment } = req.body;

            try {
                const result = await usersCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { payment } }
                );

                if (result.modifiedCount > 0) {
                    res.status(200).json({ success: true, message: "Payment status updated." });
                } else {
                    res.status(404).json({ success: false, message: "User not found or already updated." });
                }
            } catch (error) {
                console.error("Error updating payment:", error);
                res.status(500).json({ success: false, message: "Internal Server Error" });
            }
        });
        //Store payment report to active_job_payment_report
        app.post('/api/payment-report', async (req, res) => {
            try {
                const { uid, paymentMethod, transactionId, senderPhone } = req.body;

                if (!uid || !paymentMethod || !transactionId || !senderPhone) {
                    return res.status(400).json({
                        success: false,
                        message: 'সব তথ্য অবশ্যই পূরণ করতে হবে।'
                    });
                }

                // Optional: prevent duplicate tx ID
                const existing = await activeJobPymentReport.findOne({ transactionId });
                if (existing) {
                    return res.status(409).json({
                        success: false,
                        message: 'এই ট্রানজেকশন আইডি ইতিমধ্যে ব্যবহার হয়েছে।'
                    });
                }

                const result = await activeJobPymentReport.insertOne({
                    uid,
                    paymentMethod,
                    transactionId,
                    senderPhone,
                    createdAt: new Date()
                });

                res.status(201).json({
                    success: true,
                    message: 'Payment রিপোর্ট সফলভাবে সংরক্ষণ হয়েছে!',
                    insertedId: result.insertedId
                });

            } catch (error) {
                console.error("❌ Payment Report Insert Error:", error);
                res.status(500).json({
                    success: false,
                    message: "সার্ভার সমস্যার কারণে রিপোর্ট সংরক্ষণ হয়নি।"
                });
            }
        });
        // Get data by work name from active_job_update
        app.get('/api/active-job-update/:work', async (req, res) => {
            try {
                const workParam = req.params.work;

                // find the document with specific work
                const result = await activeJobUpdate.findOne({ work: workParam });

                if (!result) {
                    return res.status(404).json({
                        success: false,
                        message: `No job found with work name: ${workParam}`
                    });
                }

                res.status(200).json({
                    success: true,
                    data: result
                });

            } catch (error) {
                console.error('Error fetching job update:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: error.message
                });
            }
        });

        app.get('/api/active-job-update', async (req, res) => {
            try {
                const jobs = await activeJobUpdate.find().toArray();
                res.json({ success: true, jobs });
            } catch (error) {
                console.error("Error fetching jobs:", error);
                res.status(500).json({ success: false, message: "Failed to fetch jobs" });
            }
        });
        app.put('/api/active-job-update/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const updatedData = req.body;

                const result = await activeJobUpdate.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updatedData }
                );

                if (result.modifiedCount === 0) {
                    return res.status(404).json({ success: false, message: "No changes or job not found" });
                }

                res.json({ success: true, message: "Job updated successfully" });
            } catch (error) {
                console.error("Error updating job:", error);
                res.status(500).json({ success: false, message: "Failed to update job" });
            }
        });

        app.get('/api/referral-tree/:referralCode', async (req, res) => {
            const referralCode = req.params.referralCode;

            try {
                const buildTree = async (refCode) => {
                    // রেফারেল কোড দ্বারা ইউজার খোঁজা
                    const referredUsers = await usersCollection.find({ referredBy: refCode }).toArray();

                    // প্রতিটি ইউজারের জন্য রিকার্সিভলি তাদের চাইল্ড খুঁজে বের করা
                    const children = await Promise.all(referredUsers.map(async (user) => {
                        const child = await buildTree(user.referralCode);
                        return {
                            ...user,
                            children: child
                        };
                    }));

                    return children;
                };

                const tree = await buildTree(referralCode);
                res.status(200).json({ success: true, tree });
            } catch (error) {
                console.error('Failed to build referral tree:', error);
                res.status(500).json({ success: false, message: 'Internal server error' });
            }
        });

        //যে ভেরিফাই হলো তার profile info খজা হচ্ছে mein users collection এ
        app.get('/api/users/by-firebase-uid/:firebaseUID', async (req, res) => {
            const { firebaseUID } = req.params;
            try {
                const user = await usersCollection.findOne({ firebaseUID: firebaseUID });
                if (!user) {
                    return res.status(404).json({ message: "User not found" });
                }
                res.send(user);
            } catch (err) {
                console.error("Error finding user by firebaseUID:", err);
                res.status(500).send({ message: "Internal Server Error" });
            }
        });

        // এখানে যা আন্ডারে নতুন পেইড user রেফার হয়েছে তার uid কোজা হল
        app.get("/api/users/find-referrer-by-code/:code", async (req, res) => {
            const referralCode = req.params.code;

            if (!referralCode) {
                return res.status(400).json({ message: "Referral code is required" });
            }

            try {
                const referrer = await usersCollection.findOne({ referralCode });

                if (!referrer) {
                    return res.status(404).json({ message: "Referrer not found" });
                }

                res.status(200).json({
                    firebaseUID: referrer.firebaseUID,
                    displayName: referrer.displayName || null,
                    email: referrer.email || null,
                    _id: referrer._id,
                });
            } catch (error) {
                console.error("❌ Error fetching referrer by code:", error);
                res.status(500).json({ message: "Internal Server Error" });
            }
        });
        //তার wallet profile খজা হলো যার রেফার দিয়ে নতুন পেইড user paid হলো and 120 tk add করা হলো
        app.patch('/api/wallets/add-referral-income/:uid', async (req, res) => {
            const { uid } = req.params;
            const referralAmount = 120; // চাইলে req.body.amount থেকে নিতে পারো future-proof করার জন্য

            if (!uid) {
                return res.status(400).json({
                    success: false,
                    message: "UID is required"
                });
            }

            try {
                // Check if wallet exists
                const wallet = await usersWallets.findOne({ uid });

                if (!wallet) {
                    return res.status(404).json({
                        success: false,
                        message: "Wallet not found for this user"
                    });
                }

                // Update refererBalance and totalBalance
                const updateResult = await usersWallets.updateOne(
                    { uid },
                    {
                        $inc: {
                            refererBalance: referralAmount,
                            totalBalance: referralAmount
                        }
                    }
                );

                if (updateResult.modifiedCount === 1) {
                    const updatedWallet = await usersWallets.findOne({ uid });
                    return res.status(200).json({
                        success: true,
                        message: `Referral income of ৳${referralAmount} added successfully`,
                        wallet: updatedWallet
                    });
                } else {
                    return res.status(500).json({
                        success: false,
                        message: "Failed to update referral balance"
                    });
                }
            } catch (error) {
                console.error("❌ Error adding referral income:", error);
                return res.status(500).json({
                    success: false,
                    message: "Internal Server Error",
                    error: error.message
                });
            }
        });


        //!payment gataway start
        app.post("/initiate-payment", async (req, res) => {
            console.log("Received body:", req.body);
            const {
                name,
                email,
                product,
                amount,
                phone,
                address,
                notes,
                subscribe,
                orderSummary,
                newItemProductId,
                cartItemIds,
                cartItems,
                newItem,
                type, // 🟢 "wallet-deposit" or undefined
                firebaseUID,
                userId
            } = req.body;

            const transactionId = new ObjectId().toString();

            try {
                // ✅ যদি type === "wallet-deposit" হয়
                if (type === "wallet-deposit") {
                    const depositRecord = {
                        paymentId: transactionId,
                        customerName: name,
                        customerPhone: phone,
                        customerEmail: email,
                        amount,
                        currency: "BDT",
                        paymentStatus: "Pending",
                        type: "wallet-deposit",
                        firebaseUID,
                        userId,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };

                    await depositCollection.insertOne(depositRecord);
                } else {
                    // ✅ এটি হচ্ছে মূল অর্ডার (পণ্য) এর জন্য
                    const tempOrder = {
                        paymentId: transactionId,
                        customerName: name,
                        customerPhone: phone,
                        customerEmail: email,
                        customerAddress: address,
                        amount,
                        currency: "BDT",
                        paymentMethod: "Online Payment",
                        paymentStatus: "Pending",
                        orderStatus: "Pending",
                        products: orderSummary?.items || [],
                        orderNotes: notes,
                        subscribeToNewsletter: subscribe,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        newItemProductId: newItemProductId || null,
                        cartItemIds: cartItemIds || [],
                        cartItems: cartItems || [],
                        newItem: newItem || null
                    };

                    await orderCollection.insertOne(tempOrder);
                }

                // ✅ SSLCommerz Payment Gateway init
                const data = {
                    total_amount: amount,
                    currency: "BDT",
                    tran_id: transactionId,
                    success_url: `https://bijoy313.com/success?tran_id=${transactionId}`,
                    fail_url: `https://bijoy313.com/fail?tran_id=${transactionId}`,
                    cancel_url: `https://bijoy313.com/cancel?tran_id=${transactionId}`,
                    ipn_url: "https://bijoy-server-one.vercel.app/payment-ipn",
                    product_name: product || "Wallet Deposit",
                    cus_name: name,
                    cus_email: email,
                    cus_add1: address || "Dhaka",
                    cus_phone: phone || "01700000000",
                    shipping_method: "NO",
                    product_category: "Deposit",
                    product_profile: "general"
                };

                const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
                const apiResponse = await sslcz.init(data);
                return res.send({ GatewayPageURL: apiResponse.GatewayPageURL });

            } catch (error) {
                console.error("❌ Error in initiate-payment:", error);
                res.status(500).send({ error: "Payment initialization failed" });
            }
        });

        app.post("/payment-ipn", async (req, res) => {
            try {
                const { val_id, tran_id } = req.body;

                if (!val_id || !tran_id) {
                    return res.status(400).send("Missing val_id or tran_id");
                }

                // ✅ SSLCommerz validation
                const validationURL = `https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php?val_id=${val_id}&store_id=${store_id}&store_passwd=${store_passwd}&v=1&format=json`;

                const validationResponse = await axios.get(validationURL);
                const validatedData = validationResponse.data;

                if (validatedData.status === "VALID" || validatedData.status === "VALIDATED") {
                    validatedData.receivedAt = new Date();

                    // ✅ Save payment log
                    await paymentsCollection.insertOne(validatedData);

                    // ✅ Check if it's a wallet-deposit
                    const deposit = await depositCollection.findOne({ paymentId: tran_id });

                    if (deposit && deposit.type === "wallet-deposit") {
                        // ✅ Update deposit status
                        await depositCollection.updateOne(
                            { paymentId: tran_id },
                            {
                                $set: {
                                    paymentStatus: "Completed",
                                    updatedAt: new Date()
                                }
                            }
                        );

                        // ✅ Update wallet balance
                        const walletUser = await usersWallets.findOne({ uid: deposit.firebaseUID });

                        if (walletUser) {
                            const updatedTotal = (walletUser.totalBalance || 0) + deposit.amount;
                            const updatedEarning = (walletUser.earningBalance || 0) + deposit.amount;

                            await usersWallets.updateOne(
                                { uid: deposit.firebaseUID },
                                {
                                    $set: {
                                        totalBalance: updatedTotal,
                                        earningBalance: updatedEarning
                                    }
                                }
                            );
                        } else {
                            // ✅ If wallet doesn't exist, create new
                            await usersWallets.insertOne({
                                uid: deposit.firebaseUID,
                                totalBalance: deposit.amount,
                                earningBalance: deposit.amount,
                                withdrawalBalance: 0,
                                createdAt: new Date()
                            });
                        }

                        const user = await usersCollection.findOne({ firebaseUID: deposit.firebaseUID });

                        if (user?.userType === "client" && deposit.amount >= 100) {
                            await usersCollection.updateOne(
                                { firebaseUID: deposit.firebaseUID },
                                { $set: { payment: "paid" } }
                            );
                        } else if (deposit.amount >= 313) {
                            await usersCollection.updateOne(
                                { firebaseUID: deposit.firebaseUID },
                                { $set: { payment: "paid" } }
                            );
                        }


                        return res.status(200).send("Wallet deposit success, balance updated, and user marked as paid");
                    }

                    // ✅ Otherwise, update product order
                    await orderCollection.updateOne(
                        { paymentId: tran_id },
                        {
                            $set: {
                                paymentStatus: "Completed",
                                orderStatus: "Processing",
                                updatedAt: new Date()
                            }
                        }
                    );

                    return res.status(200).send("Product order payment verified");
                } else {
                    return res.status(400).send("Invalid payment");
                }

            } catch (error) {
                console.error("❌ Error in IPN validation:", error.message);
                res.status(500).send("Server error during validation");
            }
        });



        app.get('/payment-reports', async (req, res) => {
            try {
                const reports = await paymentsCollection.find().sort({ receivedAt: -1 }).toArray();
                res.send(reports);
            } catch (error) {
                console.error("Error fetching payment reports:", error);
                res.status(500).send({ error: "Failed to fetch payment reports" });
            }
        });

        app.get('/order-details/:tran_id', async (req, res) => {
            const { tran_id } = req.params;
            try {
                // ✅ First check in orderCollection
                const order = await orderCollection.findOne({ paymentId: tran_id });
                if (order) {
                    return res.send({ ...order, type: "order" });
                }

                // ✅ If not found, check in depositCollection
                const deposit = await depositCollection.findOne({ paymentId: tran_id });
                if (deposit) {
                    return res.send({ ...deposit, type: "wallet-deposit" });
                }

                // ✅ If still not found
                res.status(404).send({ error: "Transaction not found" });
            } catch (error) {
                res.status(500).send({ error: "Server error" });
            }
        });




        app.post('/save-order', async (req, res) => {
            try {
                const orderData = req.body;
                orderData.createdAt = new Date();
                orderData.updatedAt = new Date();

                const result = await orderCollection.insertOne(orderData);
                res.send({ success: true, orderId: result.insertedId });
            } catch (error) {
                console.error("Error saving order:", error);
                res.status(500).send({ success: false, error: "Failed to save order" });
            }
        });
        //!payment getaway end
        // Node.js + Express
        app.post("/deposit", async (req, res) => {
            const { uid, amount } = req.body;
            if (!uid || !amount) return res.status(400).json({ success: false, message: "Invalid data" });

            try {
                const user = await usersCollection.findOne({ uid });
                if (!user) return res.status(404).json({ success: false, message: "User not found" });

                const updated = await usersCollection.updateOne(
                    { uid },
                    { $inc: { balance: amount } } // make sure user has a `balance` field
                );

                res.json({ success: true, message: "Deposit successful" });
            } catch (error) {
                console.error("Deposit error:", error);
                res.status(500).json({ success: false, message: "Server error" });
            }
        });


        // job post api
        app.get('/api/microjob-categories', async (req, res) => {
            try {
                const categories = await microJobCategory.find({}).toArray();
                res.status(200).json({
                    success: true,
                    data: categories
                });
            } catch (error) {
                console.error('Error fetching categories:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch categories',
                    error: error.message
                });
            }
        });

        app.post('/api/microjobs', async (req, res) => {
            try {
                const { jobTitle, description, vacancy, price, category, links, images, agreeTerms, createdAt, uid } = req.body;

                if (!uid || !jobTitle || !description || !category) {
                    return res.status(400).json({ success: false, message: 'Incomplete job data or missing user UID' });
                }

                const jobData = {
                    jobTitle,
                    description,
                    vacancy: Number(vacancy),
                    leftVacancy: Number(vacancy),
                    price: Number(price),
                    category,
                    links,
                    images, // these should be imgbb URLs from frontend
                    agreeTerms,
                    createdAt: new Date(createdAt),
                    uid,
                    status: 'pending' // default status
                };

                const result = await microJobsPost.insertOne(jobData);

                res.status(201).json({ success: true, message: 'Job posted successfully', jobId: result.insertedId });
            } catch (error) {
                console.error('Error posting microjob:', error);
                res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
            }
        });

        // wallet balance check API
        app.post('/api/check-wallet-balance', async (req, res) => {
            try {
                const { uid, totalCost } = req.body;

                if (!uid) {
                    return res.status(400).json({ success: false, message: 'User UID is required' });
                }

                const wallet = await usersWallets.findOne({ uid });

                if (!wallet) {
                    return res.status(404).json({ success: false, message: 'Wallet not found' });
                }

                const hasSufficientBalance = wallet.totalBalance >= totalCost;

                res.status(200).json({
                    success: true,
                    hasSufficientBalance,
                    currentBalance: wallet.totalBalance,
                    requiredAmount: totalCost
                });
            } catch (error) {
                console.error('Error checking wallet balance:', error);
                res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
            }
        });

        // Deduct from wallet API
        app.post('/api/deduct-wallet', async (req, res) => {
            try {
                const { uid, amount } = req.body;

                if (!uid || !amount) {
                    return res.status(400).json({ success: false, message: 'UID and amount are required' });
                }

                const parsedAmount = parseFloat(amount);
                if (isNaN(parsedAmount) || parsedAmount <= 0) {
                    return res.status(400).json({ success: false, message: 'Invalid amount' });
                }

                const wallet = await usersWallets.findOne({ uid });
                if (!wallet) {
                    return res.status(404).json({ success: false, message: 'Wallet not found' });
                }

                if (wallet.totalBalance < parsedAmount) {
                    return res.status(400).json({
                        success: false,
                        message: 'Insufficient balance',
                        currentBalance: wallet.totalBalance,
                        requiredAmount: parsedAmount
                    });
                }

                // Deduct from wallet
                const updatedWallet = await usersWallets.updateOne(
                    { uid },
                    {
                        $inc: {
                            totalBalance: -parsedAmount,
                            earningBalance: -parsedAmount
                        }
                    }
                );

                // Record the transaction
                await depositCollection.insertOne({
                    uid,
                    amount: -parsedAmount,
                    type: 'microjob_post',
                    status: 'completed',
                    createdAt: new Date(),
                    updatedAt: new Date()
                });

                res.status(200).json({
                    success: true,
                    message: 'Amount deducted successfully',
                    newBalance: wallet.totalBalance - parsedAmount
                });
            } catch (error) {
                console.error('Error deducting from wallet:', error);
                res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
            }
        });


        // Add this to your server.js file
        app.get('/api/microjobs', async (req, res) => {
            try {
                const jobs = await microJobsPost.find({ status: 'approved' }).toArray(); // Only fetch approved jobs
                res.status(200).json({
                    success: true,
                    data: jobs
                });
            } catch (error) {
                console.error('Error fetching micro jobs:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch micro jobs',
                    error: error.message
                });
            }
        });
        // Get single microjob by ID
        app.get('/api/microjobs/:id', async (req, res) => {
            try {
                const jobId = req.params.id;

                // Validate ID format
                if (!ObjectId.isValid(jobId)) {
                    return res.status(400).json({ success: false, message: 'Invalid job ID' });
                }

                const job = await microJobsPost.findOne({ _id: new ObjectId(jobId) });

                if (!job) {
                    return res.status(404).json({ success: false, message: 'Job not found' });
                }

                res.status(200).json({ success: true, data: job });
            } catch (error) {
                console.error('Error fetching job:', error);
                res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
            }
        });
        // Check if user already applied for a job
        app.post('/api/check-applied-job', async (req, res) => {
            try {
                const { jobId, userId } = req.body;

                const existingApplication = await appliedMicroJobs.findOne({
                    jobId: new ObjectId(jobId),
                    'user.uid': userId
                });

                res.json({
                    success: true,
                    alreadyApplied: !!existingApplication
                });
            } catch (error) {
                console.error('Error checking job application:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error'
                });
            }
        });

        // Apply for a job
        app.post('/api/apply-job', async (req, res) => {
            try {
                const { jobId, userId, jobData } = req.body;

                // Get user data
                const userData = await usersCollection.findOne({ firebaseUID: userId });
                if (!userData) {
                    return res.status(404).json({
                        success: false,
                        message: 'User not found'
                    });
                }

                // Create application document
                const applicationData = {
                    jobId: new ObjectId(jobId),
                    jobData: jobData,
                    user: {
                        uid: userId,
                        displayName: userData.displayName,
                        email: userData.email,
                        phone: userData.phone
                    },
                    status: 'applied',
                    appliedAt: new Date(),
                    updatedAt: new Date()
                };

                // Insert into applied_micro_jobs collection
                const result = await appliedMicroJobs.insertOne(applicationData);

                res.json({
                    success: true,
                    message: 'Job application submitted successfully',
                    applicationId: result.insertedId
                });
            } catch (error) {
                console.error('Error applying for job:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error'
                });
            }
        });
        // Get job application status
        app.get('/api/job-application/:jobId', async (req, res) => {
            try {
                const { jobId } = req.params;
                const userId = req.user.uid; // Assuming you have auth middleware

                if (!ObjectId.isValid(jobId)) {
                    return res.status(400).json({ success: false, message: 'Invalid job ID' });
                }

                const application = await appliedMicroJobs.findOne({
                    jobId: new ObjectId(jobId),
                    'user.uid': userId
                });

                if (!application) {
                    return res.status(404).json({ success: false, message: 'Application not found' });
                }

                res.json({ success: true, data: application });
            } catch (error) {
                console.error('Error fetching application:', error);
                res.status(500).json({ success: false, message: 'Internal server error' });
            }
        });
        // Get jobs posted by a specific user
        app.get('/api/microjobs/by-user/:uid', async (req, res) => {
            try {
                const uid = req.params.uid;

                const jobs = await microJobsPost.find({ uid }).sort({ createdAt: -1 }).toArray();

                res.status(200).json({
                    success: true,
                    data: jobs
                });
            } catch (error) {
                console.error('Error fetching user jobs:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: error.message
                });
            }
        });
        app.get('/api/applied-jobs/:uid', async (req, res) => {
            try {
                const uid = req.params.uid;

                const applications = await appliedMicroJobs.find({ 'user.uid': uid })
                    .sort({ appliedAt: -1 })
                    .toArray();

                const jobs = await Promise.all(applications.map(async app => {
                    const job = await microJobsPost.findOne({ _id: new ObjectId(app.jobId) });
                    return {
                        ...app,
                        jobDetails: job
                    };
                }));

                res.status(200).json({
                    success: true,
                    appliedJobCount: applications.length,
                    data: jobs
                });
            } catch (error) {
                console.error('Error fetching applied jobs:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: error.message
                });
            }
        });

        app.post('/api/submit-work', async (req, res) => {
            try {
                const { uid, jobId, comment, imageUrls } = req.body;

                if (!uid || !jobId || !comment || !Array.isArray(imageUrls)) {
                    return res.status(400).json({ success: false, message: 'Missing required fields' });
                }

                const doc = {
                    uid,
                    jobId,
                    comment,
                    imageUrls,
                    submittedAt: new Date()
                };

                const result = await microJobPendingWorks.insertOne(doc);

                res.status(201).json({
                    success: true,
                    message: 'Work submitted successfully',
                    insertedId: result.insertedId
                });
            } catch (error) {
                console.error('Error in /api/submit-work:', error.message);
                res.status(500).json({ success: false, message: 'Server error', error: error.message });
            }
        });
        // ✅ [GET] Get user's posted jobs with reports
        app.get('/api/my-posted-jobs-with-reports/:uid', async (req, res) => {
            try {
                const uid = req.params.uid;
                if (!uid) return res.status(400).json({ success: false, message: "UID is required" });

                // Get all jobs posted by this user
                const userJobs = await microJobsPost.find({ uid }).toArray();

                // Get all reports related to this user's jobs
                const jobIds = userJobs.map(job => job._id.toString()); // Convert to string for matching
                const reports = await microJobPendingWorks.find({
                    jobId: { $in: jobIds }
                }).toArray();

                // Map reports to jobs
                const jobsWithReports = userJobs.map(job => {
                    const jobId = job._id.toString();
                    const jobReports = reports.filter(report => report.jobId === jobId);
                    return {
                        ...job,
                        reports: jobReports
                    };
                });

                // ✅ রিপোর্টের মোট সংখ্যা বের করি
                const totalReports = reports.length;

                res.status(200).json({
                    success: true,
                    totalReports, // ⬅️ এটিই তুমি frontend-এ use করতে পারো
                    data: jobsWithReports
                });

            } catch (error) {
                console.error('❌ Error in /api/my-posted-jobs-with-reports:', error.message);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: error.message
                });
            }
        });

        app.post('/api/approve-job-report/:reportId', async (req, res) => {
            try {
                const reportId = req.params.reportId;
                const { jobData, reportData, reporterUid, jobPrice } = req.body;

                if (!reportId || !reporterUid || !jobPrice || !reportData || !jobData) {
                    return res.status(400).json({ success: false, message: "Missing data" });
                }

                // ✅ Move to completed collection
                await microJobCompletedWorks.insertOne({
                    ...reportData,
                    jobInfo: jobData,
                    approvedAt: new Date()
                });

                // ✅ Update reporter's wallet
                const wallet = await usersWallets.findOne({ uid: reporterUid });
                const currentEarning = wallet?.microJobEarning || 0;

                await usersWallets.updateOne(
                    { uid: reporterUid },
                    {
                        $inc: {
                            microJobEarning: jobPrice,
                            totalBalance: jobPrice
                        }
                    },
                    { upsert: true }
                );


                // ✅ Remove original report
                await microJobPendingWorks.deleteOne({ _id: new ObjectId(reportId) });

                // ✅ Update job vacancy
                const jobId = jobData._id;
                const originalVacancy = jobData.vacancy || 0;

                // Get job's current leftVacancy (if exists)
                const jobInDb = await microJobsPost.findOne({ _id: new ObjectId(jobId) });
                const currentLeft = jobInDb?.leftVacancy ?? originalVacancy;

                const updatedLeftVacancy = currentLeft - 1;

                await microJobsPost.updateOne(
                    { _id: new ObjectId(jobId) },
                    {
                        $set: {
                            leftVacancy: updatedLeftVacancy
                        }
                    }
                );

                res.json({ success: true, message: "Report approved, earnings added, and vacancy updated" });
            } catch (error) {
                console.error("❌ Error in approve-job-report:", error.message);
                res.status(500).json({ success: false, message: "Internal server error" });
            }
        });

        app.post('/api/cancel-job-report/:reportId', async (req, res) => {
            try {
                const reportId = req.params.reportId;
                const { jobData, reportData } = req.body;

                if (!reportData || !jobData) {
                    return res.status(400).json({ success: false, message: "Missing data" });
                }

                // ✅ Move to cancel collection
                await microJobCancelWorks.insertOne({
                    ...reportData,
                    jobInfo: jobData,
                    cancelledAt: new Date()
                });

                // ✅ Remove from pending works
                await microJobPendingWorks.deleteOne({ _id: new ObjectId(reportId) });

                res.json({ success: true, message: "Report cancelled and archived" });
            } catch (error) {
                console.error("❌ Error in cancel-job-report:", error.message);
                res.status(500).json({ success: false, message: "Internal server error" });
            }
        });

        app.get('/api/user-posted-job-count/:uid', async (req, res) => {
            const userUid = req.params.uid;
            if (!userUid) return res.status(400).json({ success: false, message: "uid is required" });

            const count = await getUserPostedJobCount(userUid);
            res.json({ success: true, postedJobCount: count });
        });

        app.get('/api/completed-microjobs/:uid', async (req, res) => {
            try {
                const uid = req.params.uid;
                if (!uid) {
                    return res.status(400).json({ success: false, message: "UID is required" });
                }

                const completedJobs = await microJobCompletedWorks
                    .find({ uid })
                    .sort({ approvedAt: -1 }) // সাম্প্রতিক কাজ আগে দেখাতে চাইলে
                    .toArray();

                res.status(200).json({
                    success: true,
                    data: completedJobs
                });
            } catch (error) {
                console.error("❌ Error in /api/completed-microjobs/:uid", error.message);
                res.status(500).json({ success: false, message: "Internal server error", error: error.message });
            }
        });
        app.get('/api/pending-microjobs/:uid', async (req, res) => {
            try {
                const uid = req.params.uid;

                if (!uid) {
                    return res.status(400).json({ success: false, message: "UID is required" });
                }

                const pendingJobs = await microJobPendingWorks
                    .find({ uid })
                    .sort({ submittedAt: -1 }) // সর্বশেষ সাবমিট করা আগে দেখাবে
                    .toArray();

                res.status(200).json({
                    success: true,
                    data: pendingJobs
                });
            } catch (error) {
                console.error("❌ Error in /api/pending-microjobs/:uid", error.message);
                res.status(500).json({ success: false, message: "Internal server error", error: error.message });
            }
        });
        app.get('/api/referral-count/:uid', async (req, res) => {
            try {
                const uid = req.params.uid;
                if (!uid) return res.status(400).json({ success: false, message: "UID is required" });

                const userData = await usersCollection.findOne({ firebaseUID: uid });
                if (!userData) {
                    return res.status(404).json({ success: false, message: "User not found" });
                }

                const referralCode = userData.referralCode;
                const count = await usersCollection.countDocuments({ referredBy: referralCode });

                res.status(200).json({
                    success: true,
                    referralCount: count
                });
            } catch (err) {
                console.error("❌ Error in /api/referral-count/:uid", err.message);
                res.status(500).json({ success: false, message: "Internal server error", error: err.message });
            }
        });
        // Express API route
        app.get('/api/user-wallet/:uid', async (req, res) => {
            try {
                const uid = req.params.uid;

                if (!uid) {
                    return res.status(400).json({ success: false, message: "UID is required" });
                }

                const wallet = await usersWallets.findOne({ uid });

                if (!wallet) {
                    return res.status(404).json({ success: false, message: "Wallet not found" });
                }

                res.status(200).json({
                    success: true,
                    data: wallet
                });
            } catch (error) {
                console.error("Error fetching wallet:", error);
                res.status(500).json({ success: false, message: "Internal server error", error: error.message });
            }
        });
        app.get("/api/referrals/:uid", async (req, res) => {
            const { uid } = req.params;

            if (!uid) {
                return res.status(400).json({ success: false, message: "UID is required" });
            }

            try {
                // Step 1: মূল ইউজার খুঁজে বের করা যিনি রেফার করছিলেন
                const refererUser = await usersCollection.findOne({ firebaseUID: uid });

                if (!refererUser) {
                    return res.status(404).json({ success: false, message: "Referer user not found" });
                }

                const referCode = refererUser.referralCode;

                if (!referCode) {
                    return res.status(404).json({ success: false, message: "Referral code not found for user" });
                }

                // Step 2: রেফার কোড match করে রেফার্ড ইউজারদের খোঁজা
                const referredUsers = await usersCollection.find({ referredBy: referCode }).toArray();

                return res.status(200).json({
                    success: true,
                    count: referredUsers.length,
                    referredUsers
                });

            } catch (error) {
                console.error("❌ Error fetching referral users:", error);
                return res.status(500).json({ success: false, message: "Internal server error" });
            }
        });


        // *For Wallet
        app.post("/api/withdraw", async (req, res) => {
            const { userId, amount, currency, paymentMethod, accountNumber, status = "pending", fee = 0 } = req.body;

            if (!userId || !amount || isNaN(amount) || !paymentMethod || !accountNumber) {
                return res.status(400).json({ success: false, message: "Invalid request body" });
            }

            const withdrawalFee = parseFloat(fee) || 0;
            const withdrawalAmount = parseFloat(amount);
            const MINIMUM_BALANCE = 13;

            try {
                // 1. Check user wallet
                const wallet = await usersWallets.findOne({ uid: userId });
                if (!wallet) return res.status(404).json({ success: false, message: "User wallet not found" });

                // 2. Check minimum balance
                const remainingBalance = wallet.totalBalance - withdrawalAmount;
                if (remainingBalance < MINIMUM_BALANCE) {
                    return res.status(400).json({
                        success: false,
                        message: `Insufficient balance. Minimum ${MINIMUM_BALANCE} BDT must remain.`
                    });
                }

                // 3. Update wallet balance
                await usersWallets.updateOne(
                    { uid: userId },
                    {
                        $inc: {
                            totalBalance: -withdrawalAmount,
                            withdrawalBalance: withdrawalAmount
                        }
                    }
                );

                // 4. Create withdrawal record
                const withdrawDoc = {
                    userId,
                    amount: withdrawalAmount,
                    currency,
                    paymentMethod,
                    accountNumber,
                    status,
                    fee: withdrawalFee,
                    createdAt: new Date()
                };

                const result = await withdrawReports.insertOne(withdrawDoc);

                // 5. Send SMS to admin (async - don't wait for response)
                const user = await usersCollection.findOne({ firebaseUID: userId });
                const userName = user?.displayName || 'Unknown User';

                const smsMessage = `[Withdrawal Request]
User: ${userName}
Amount: ${withdrawalAmount} BDT
Method: ${paymentMethod}
Account: ${accountNumber}
Status: ${status}
Time: ${new Date().toLocaleString()}`;

                sendAdminSMS(smsMessage)
                    .then(() => console.log('Admin notified via SMS'))
                    .catch(err => console.error('SMS notification failed:', err));

                // 6. Respond to client
                res.status(200).json({
                    success: true,
                    data: { ...withdrawDoc, _id: result.insertedId }
                });

            } catch (err) {
                console.error("Withdraw error:", err);
                res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: err.message
                });
            }
        });

        app.get("/api/withdrawals/:userId", async (req, res) => {
            const { userId } = req.params;

            try {
                const history = await withdrawReports
                    .find({ userId })
                    .sort({ createdAt: -1 })
                    .toArray();

                res.status(200).json({ success: true, data: history });

            } catch (err) {
                console.error("Fetch withdraw history error:", err);
                res.status(500).json({ success: false, message: "Internal server error" });
            }
        });
        //!sumaiya made api
        app.get('/api/products/category/:slug', async (req, res) => {
            try {
                const slug = req.params.slug.toLowerCase();

                const query = {
                    $expr: {
                        $eq: [
                            { $arrayElemAt: ["$tags", -1] }, // tags array-এর শেষ আইটেম
                            slug
                        ]
                    }
                };

                const products = await productsCollection.find(query).toArray();

                res.status(200).json({
                    success: true,
                    products,
                    total: products.length
                });
            } catch (error) {
                console.error('Error fetching products by category:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error'
                });
            }
        });
        // *For Favourites
        app.get("/api/favorites/:uid", async (req, res) => {
            const uid = req.params.uid;

            try {
                // ✅ Use globally assigned collections, not from new database connection
                const favoriteDocs = await favoritesCollection.find({ userId: uid }).toArray();

                if (favoriteDocs.length === 0) {
                    return res.status(200).json({
                        success: true,
                        favorites: [],
                        total: 0
                    });
                }

                const productObjectIds = favoriteDocs.map(fav => new ObjectId(fav.productId));

                const favoriteProducts = await productsCollection.find({
                    _id: { $in: productObjectIds }
                }).toArray();

                res.status(200).json({
                    success: true,
                    favorites: favoriteProducts,
                    total: favoriteProducts.length
                });
            } catch (err) {
                console.error("Error fetching favorites:", err);
                res.status(500).json({ error: "Internal server error" });
            }
        });

        //* For Search
        app.get("/api/search", async (req, res) => {
            const query = req.query.q || "";

            if (!query.trim()) {
                return res.json([]);
            }

            try {
                const regex = new RegExp(query, "i");
                const results = await productsCollection
                    .find({
                        $or: [
                            { productName: { $regex: regex } },
                            { description: { $regex: regex } },
                            { tags: { $regex: regex } },
                            { keywords: { $regex: regex } },
                        ],
                    })
                    .project({ productName: 1, slug: 1 })
                    .limit(10)
                    .toArray();

                res.json(results);
            } catch (error) {
                console.error("Search error:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });
        app.post('/api/resellers', async (req, res) => {
            try {
                const { fullName, phone, businessName, website, address, nidNumber, termsAccepted, uid } = req.body;

                // Basic validation
                if (!fullName || !phone || !businessName || !address || !nidNumber || typeof termsAccepted !== 'boolean') {
                    return res.status(400).json({
                        success: false,
                        message: 'সব প্রয়োজনীয় তথ্য প্রদান করুন'
                    });
                }

                // Validate phone number
                const cleanedPhone = phone.replace(/\D/g, '');
                const formattedPhone = cleanedPhone.startsWith('01') && cleanedPhone.length === 11
                    ? cleanedPhone
                    : `01${cleanedPhone.substring(cleanedPhone.length - 9)}`;

                if (formattedPhone.length !== 11 || !formattedPhone.startsWith('01')) {
                    return res.status(400).json({
                        success: false,
                        message: 'সঠিক ফোন নম্বর দিন (01XXXXXXXXX)'
                    });
                }

                // Validate website URL if provided
                let formattedWebsite = null;
                if (website) {
                    try {
                        // Add https:// if not present
                        formattedWebsite = website.startsWith('http') ? website : `https://${website}`;
                        // Validate URL format
                        new URL(formattedWebsite);
                    } catch (error) {
                        return res.status(400).json({
                            success: false,
                            message: 'সঠিক ওয়েবসাইট লিংক প্রদান করুন',
                            field: 'website'
                        });
                    }
                }

                // Create reseller document
                const newReseller = {
                    fullName: fullName.trim(),
                    phone: formattedPhone,
                    businessName: businessName.trim(),
                    website: formattedWebsite, // Store formatted website or null
                    address: address.trim(),
                    nidNumber: nidNumber.trim(),
                    termsAccepted,
                    uid: uid || null, // Firebase UID
                    status: 'pending',
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                // Insert into MongoDB
                const result = await resellerInfo.insertOne(newReseller);

                res.status(201).json({
                    success: true,
                    message: 'রিসেলার আবেদন সফলভাবে জমা হয়েছে',
                    data: {
                        _id: result.insertedId,
                        ...newReseller
                    }
                });

            } catch (error) {
                console.error('Error saving reseller:', error);

                // Handle duplicate key errors
                if (error.code === 11000) {
                    const field = Object.keys(error.keyPattern)[0];
                    const message = field === 'phone'
                        ? 'এই ফোন নম্বর দিয়ে পূর্বেই আবেদন করা হয়েছে'
                        : field === 'nidNumber'
                            ? 'এই এনআইডি নম্বর দিয়ে পূর্বেই আবেদন করা হয়েছে'
                            : 'এই ইউজার পূর্বেই আবেদন করেছেন';

                    return res.status(409).json({
                        success: false,
                        message,
                        field
                    });
                }

                res.status(500).json({
                    success: false,
                    message: 'সার্ভার ত্রুটি হয়েছে',
                    error: process.env.NODE_ENV === 'development' ? error.message : undefined
                });
            }
        });
        app.get('/api/resellers', async (req, res) => {
            try {
                const { status } = req.query;
                const query = status ? { status } : {};

                const resellers = await resellerInfo.find(query).sort({ createdAt: -1 }).toArray();

                // Ensure proper headers and JSON response
                res.setHeader('Content-Type', 'application/json');
                res.status(200).json({
                    success: true,
                    data: resellers
                });
            } catch (error) {
                console.error('Error fetching resellers:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Update reseller status and update user collection if approved
        app.put('/api/resellers/:id/status', async (req, res) => {
            try {
                const { id } = req.params;
                const { status, uid } = req.body;

                if (!["approved", "rejected", "pending"].includes(status)) {
                    return res.status(400).json({
                        success: false,
                        error: "Invalid status"
                    });
                }

                // Update reseller status
                const result = await resellerInfo.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status, updatedAt: new Date() } }
                );

                if (result.modifiedCount === 0) {
                    return res.status(404).json({
                        success: false,
                        error: "Reseller not found"
                    });
                }

                // If approved, update user collection
                if (status === "approved" && uid) {
                    await usersCollection.updateOne(
                        { firebaseUID: uid },
                        { $set: { reseller: true } }
                    );
                }

                res.json({
                    success: true,
                    message: `Reseller ${status} successfully`
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });
        //!sumaiya madem api end
        // Category-wise micro jobs API
        app.get('/api/microjobs-by-category', async (req, res) => {
            try {
                const { category } = req.query;

                // Validate category parameter
                if (!category) {
                    return res.status(400).json({
                        success: false,
                        message: 'Category parameter is required'
                    });
                }

                let query = { status: 'approved' };

                // If category is not "All Category", add category filter
                if (category !== "All Category") {
                    query.category = category;
                }

                const jobs = await microJobsPost.find(query).toArray();

                res.status(200).json({
                    success: true,
                    data: jobs
                });
            } catch (error) {
                console.error('Error fetching micro jobs by category:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch micro jobs by category',
                    error: error.message
                });
            }
        });
        // Categories with job count API
        app.get('/api/microjob-categories-with-count', async (req, res) => {
            try {
                // Get all approved jobs
                const allJobs = await microJobsPost.find({ status: 'approved' }).toArray();

                // Get all unique categories from jobs
                const categoriesMap = {};
                allJobs.forEach(job => {
                    if (!categoriesMap[job.category]) {
                        categoriesMap[job.category] = 0;
                    }
                    categoriesMap[job.category]++;
                });

                // Convert to array format
                const categoriesWithCount = Object.keys(categoriesMap).map(category => ({
                    name: category,
                    count: categoriesMap[category]
                }));

                // Add "All Category" with total count
                categoriesWithCount.unshift({
                    name: "All Category",
                    count: allJobs.length
                });

                res.status(200).json({
                    success: true,
                    data: categoriesWithCount
                });
            } catch (error) {
                console.error('Error fetching categories with count:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch categories with count',
                    error: error.message
                });
            }


        });

        // GET completed jobs by uid
        app.get('/api/microjobs/completed/:uid', async (req, res) => {
            const uid = req.params.uid;

            try {
                const result = await microJobCompletedWorks
                    .find({ uid }) // root level uid এর সাথে মিল
                    .toArray();

                res.status(200).json({
                    success: true,
                    data: result
                });
            } catch (error) {
                console.error("Error fetching completed microjobs:", error);
                res.status(500).json({
                    success: false,
                    message: 'Server error'
                });
            }
        });
        // server/index.js or where your Express app is defined
        // ✅ Update this route to use the correct collection and logic
        app.get('/api/completed-jobs/:uid', async (req, res) => {
            const { uid } = req.params;

            if (!uid) {
                return res.status(400).json({ success: false, message: "UID is required" });
            }

            try {
                const completedJobs = await userCompleteTask
                    .find({ uid: uid })
                    .sort({ createdAt: -1 })
                    .toArray();

                res.json({
                    success: true,
                    data: completedJobs,
                });
            } catch (err) {
                console.error("Failed to fetch completed jobs:", err);
                res.status(500).json({ success: false, message: "Server error" });
            }
        });
        // server/index.js

        app.get('/api/withdraw-reports/:uid', async (req, res) => {
            const { uid } = req.params;

            if (!uid) {
                return res.status(400).json({ success: false, message: "UID is required" });
            }

            try {
                const reports = await withdrawReports
                    .find({ userId: uid })
                    .sort({ createdAt: -1 })
                    .toArray();

                res.status(200).json({
                    success: true,
                    data: reports
                });
            } catch (error) {
                console.error("Error fetching withdraw reports:", error);
                res.status(500).json({
                    success: false,
                    message: "Server error"
                });
            }
        });
        app.get('/api/withdraw-reports-by-condition/:uid', async (req, res) => {
            const { uid } = req.params;

            if (!uid) {
                return res.status(400).json({ success: false, message: "UID is required" });
            }

            try {
                const allReports = await withdrawReports
                    .find({ userId: uid })
                    .sort({ createdAt: -1 })
                    .toArray();

                const now = new Date();
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();

                let currentMonthSuccessTotal = 0;
                let allTimeSuccessTotal = 0;
                let pendingTotal = 0;

                allReports.forEach(report => {
                    const created = new Date(report.createdAt);

                    if (report.status === "success") {
                        allTimeSuccessTotal += Number(report.amount);

                        if (
                            created.getFullYear() === currentYear &&
                            created.getMonth() === currentMonth
                        ) {
                            currentMonthSuccessTotal += Number(report.amount);
                        }
                    }

                    if (report.status === "pending") {
                        pendingTotal += Number(report.amount);
                    }
                });

                res.status(200).json({
                    success: true,
                    data: allReports,
                    totals: {
                        currentMonthSuccessTotal,
                        allTimeSuccessTotal,
                        pendingTotal
                    }
                });
            } catch (error) {
                console.error("Error fetching withdraw reports:", error);
                res.status(500).json({
                    success: false,
                    message: "Server error"
                });
            }
        });
        app.get('/api/paid-freelancers', async (req, res) => {
            try {
                const freelancers = await usersCollection
                    .find({ payment: 'paid', userType: 'freelancer' })
                    .project({ displayName: 1 }) // শুধু displayName আনবে
                    .toArray();

                res.status(200).json({
                    success: true,
                    data: freelancers,
                    count: freelancers.length,
                    multipliedAmount: freelancers.length * 13
                });
            } catch (error) {
                console.error("Error fetching paid freelancers:", error);
                res.status(500).json({ success: false, message: "Server error" });
            }
        });
        app.get('/api/income-summary', async (req, res) => {
            const { uid, filter, startDate, endDate } = req.query;

            if (!uid || !filter) {
                return res.status(400).json({ success: false, message: "uid and filter are required" });
            }

            const now = new Date();
            let from = null;
            let to = now;

            const startOfDay = (d) => new Date(d.setHours(0, 0, 0, 0));
            const endOfDay = (d) => new Date(d.setHours(23, 59, 59, 999));

            if (filter === 'this_time') {
                from = new Date(0); // all time
            } else if (filter === 'this_week') {
                const day = now.getDay();
                const diff = now.getDate() - day + (day === 0 ? -6 : 1);
                from = startOfDay(new Date(now.setDate(diff)));
            } else if (filter === 'this_month') {
                from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
            } else if (filter === 'this_year') {
                from = startOfDay(new Date(now.getFullYear(), 0, 1));
            } else if (filter === 'custom') {
                if (!startDate || !endDate) {
                    return res.status(400).json({ success: false, message: "Start and end dates required for custom filter" });
                }
                from = new Date(startDate);
                to = new Date(endDate);
            } else {
                return res.status(400).json({ success: false, message: "Invalid filter type" });
            }

            try {
                const activeJobMatch = {
                    uid,
                    createdAt: { $gte: from, $lte: to }
                };

                const microJobMatch = {
                    uid,
                    approvedAt: { $gte: from, $lte: to }
                };

                const walletMatch = { uid };
                if (filter !== 'this_time') {
                    walletMatch.createdAt = { $gte: from, $lte: to };
                }

                const activeJobIncomeAgg = await userCompleteTask.aggregate([
                    { $match: activeJobMatch },
                    { $group: { _id: null, total: { $sum: "$remainingBalance" } } }
                ]).toArray();

                const microJobIncomeAgg = await microJobCompletedWorks.aggregate([
                    { $match: microJobMatch },
                    { $group: { _id: null, total: { $sum: "$jobInfo.price" } } }
                ]).toArray();

                const walletAgg = await usersWallets.aggregate([
                    { $match: walletMatch },
                    { $group: { _id: null, total: { $sum: "$refererBalance" } } }
                ]).toArray();

                const activeJobIncome = activeJobIncomeAgg[0]?.total || 0;
                const microJobIncome = microJobIncomeAgg[0]?.total || 0;
                const referralIncome = walletAgg[0]?.total || 0;
                const totalIncome = activeJobIncome + microJobIncome + referralIncome;

                const activeJobData = await userCompleteTask.find(activeJobMatch).toArray();
                const microJobData = await microJobCompletedWorks.find(microJobMatch).toArray();
                const referralData = await usersWallets.findOne({ uid });

                res.json({
                    success: true,
                    activeJobIncome,
                    microJobIncome,
                    referralIncome,
                    totalIncome,
                    activeJobData,
                    microJobData,
                    referralData
                });

            } catch (error) {
                console.error("Income Summary Error:", error);
                res.status(500).json({ success: false, message: "Server Error", error: error.message });
            }
        });

        // GET paginated users
        app.post('/api/admin-request', async (req, res) => {
            try {
                const { uid, email, displayName, phone } = req.body;

                if (!uid) {
                    return res.status(400).json({ success: false, message: "UID is required" });
                }

                // একই uid দিয়ে আগেই request দেওয়া আছে কি না চেক
                const existing = await adminRequest.findOne({ uid });
                if (existing) {
                    return res.status(409).json({ success: false, message: "Request already exists" });
                }

                const result = await adminRequest.insertOne({
                    uid,
                    email,
                    phone,
                    displayName,
                    status: "pending",
                    requestedAt: new Date()
                });

                res.status(201).json({ success: true, message: "Request submitted", id: result.insertedId });
            } catch (err) {
                console.error(err);
                res.status(500).json({ success: false, message: "Server error", error: err.message });
            }
        });

        app.get('/api/admin-requests', async (req, res) => {
            try {
                const requests = await adminRequest.find().sort({ requestedAt: -1 }).toArray();
                res.send(requests);
            } catch (err) {
                res.status(500).send({ error: 'Failed to fetch requests' });
            }
        });
        app.patch('/api/admin-requests/:uid/approve', async (req, res) => {
            const uid = req.params.uid;

            try {
                // Step 1: Update user role
                const result = await usersCollection.updateOne(
                    { firebaseUID: uid },
                    { $set: { roles: ["admin"] } }
                );

                // Step 2: Delete from admin_request
                await adminRequest.deleteOne({ uid });

                res.send({ success: true, message: 'User approved as admin' });
            } catch (err) {
                res.status(500).send({ error: 'Approval failed' });
            }
        });
        app.delete('/api/admin-requests/:uid/reject', async (req, res) => {
            const uid = req.params.uid;

            try {
                await adminRequest.deleteOne({ uid });
                res.send({ success: true, message: 'Request rejected and deleted' });
            } catch (err) {
                res.status(500).send({ error: 'Rejection failed' });
            }
        });


        //!after mejor update api start here
        
        // ✅ Express API route
        // GET /api/users-for-admin?page=1&limit=20&search=abc

        app.get('/api/users-for-admin', async (req, res) => {
            try {
                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 20;
                const search = req.query.search || '';
                const payment = req.query.payment || '';

                const skip = (page - 1) * limit;

                const searchQuery = {
                    $or: [
                        { email: { $regex: search, $options: 'i' } },
                        { phone: { $regex: search, $options: 'i' } },
                        { referralCode: { $regex: search, $options: 'i' } },
                    ]
                };

                // Apply payment filter if requested
                if (payment === 'paid') {
                    searchQuery.payment = 'paid';
                } else if (payment === 'unpaid') {
                    searchQuery.payment = { $ne: 'paid' };
                }

                // ✅ Paginated users
                const users = await usersCollection
                    .find(searchQuery)
                    .skip(skip)
                    .limit(limit)
                    .toArray();

                const total = await usersCollection.countDocuments(searchQuery);

                const firebaseUIDs = users.map(user => user.firebaseUID).filter(Boolean);

                const wallets = await usersWallets
                    .find({ uid: { $in: firebaseUIDs } })
                    .toArray();

                const usersWithWallets = users.map(user => {
                    const wallet = wallets.find(w => w.uid === user.firebaseUID);
                    return {
                        ...user,
                        extraWallet: wallet || null
                    };
                });

                // ✅ Total counts regardless of pagination or search
                const [paidCount, unpaidCount] = await Promise.all([
                    usersCollection.countDocuments({ payment: 'paid' }),
                    usersCollection.countDocuments({ $or: [{ payment: { $ne: 'paid' } }, { payment: { $exists: false } }] })
                ]);

                res.status(200).json({
                    success: true,
                    users: usersWithWallets,
                    total,
                    paidCount,
                    unpaidCount
                });

            } catch (error) {
                console.error('Error fetching users with wallets:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch users',
                    error: error.message
                });
            }
        });


        // Ban or unban a user
        app.put('/api/users/ban-toggle/:id', async (req, res) => {
            const userId = req.params.id;
            const { ban } = req.body;

            try {
                const result = await usersCollection.updateOne(
                    { _id: new ObjectId(userId) },
                    { $set: { ban: ban } } // true or false
                );

                res.json({
                    success: true,
                    message: `User has been ${ban ? 'banned' : 'unbanned'} successfully.`,
                });
            } catch (err) {
                res.status(500).json({
                    success: false,
                    message: 'Error updating user ban status',
                    error: err.message
                });
            }
        });


        app.get('/api/unpaid-users', async (req, res) => {
            try {
                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 20;
                const skip = (page - 1) * limit;

                
                const query = { payment: { $ne: "paid" } };

                const total = await usersCollection.countDocuments(query);
                const users = await usersCollection.find(query)
                    .sort({ joinedAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .toArray();

                res.status(200).json({
                    users,
                    currentPage: page,
                    totalPages: Math.ceil(total / limit)
                });
            } catch (err) {
                res.status(500).json({
                    message: 'Failed to fetch unpaid users',
                    error: err.message
                });
            }
        });

        app.patch('/api/users/:id/payment', async (req, res) => {
            try {
                const userId = req.params.id;
                const result = await usersCollection.updateOne(
                    { _id: new ObjectId(userId) },
                    { $set: { payment: "paid" } }
                );

                if (result.modifiedCount > 0) {
                    res.status(200).json({ message: "User marked as paid" });
                } else {
                    res.status(404).json({ message: "User not found or already paid" });
                }
            } catch (err) {
                res.status(500).json({ message: "Failed to update payment", error: err.message });
            }
        });

        
        // 🔍 Search unpaid users by phone
        app.get('/api/unpaid-users/search', async (req, res) => {
            try {
                const phone = req.query.phone;
                if (!phone) {
                    return res.status(400).json({ message: "Phone number required" });
                }

                const query = {
                    payment: { $ne: "paid" },
                    phone: { $regex: phone, $options: 'i' }
                };

                const users = await usersCollection.find(query).sort({ joinedAt: -1 }).toArray();

                res.status(200).json({ users });
            } catch (err) {
                res.status(500).json({ message: "Failed to search unpaid users", error: err.message });
            }
        });


        
        app.put('/api/headline-update', async (req, res) => {
            const { news } = req.body;

            if (!news) {
                return res.status(400).json({ success: false, message: "News content is required" });
            }

            try {
                const result = await headlineUpdate.updateOne(
                    {}, // empty filter = first document found
                    { $set: { news } }
                );

                if (result.modifiedCount > 0) {
                    res.json({ success: true, message: "Headline updated successfully" });
                } else {
                    res.json({ success: false, message: "No changes made or headline not found" });
                }
            } catch (error) {
                console.error("Error updating headline:", error);
                res.status(500).json({ success: false, message: "Server error", error: error.message });
            }
        });

        app.get('/api/headline', async (req, res) => {
            try {
                const headline = await headlineUpdate.findOne({});

                if (!headline) {
                    return res.status(404).json({ success: false, message: "Headline not found" });
                }

                res.json({ success: true, headline });
            } catch (error) {
                console.error("Error fetching headline:", error);
                res.status(500).json({ success: false, message: "Server error", error: error.message });
            }
        });


        // Get paginated micro jobs with filters (status & category)
        app.get('/api/microjob-posts', async (req, res) => {
            const { status, category, page = 1, limit = 20 } = req.query;
            const query = {};
            if (status && status !== 'all') query.status = status;
            if (category && category !== 'all') query.category = category;

            const skip = (parseInt(page) - 1) * parseInt(limit);

            try {
                const total = await microJobsPost.countDocuments(query);
                const jobs = await microJobsPost
                    .find(query)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(parseInt(limit))
                    .toArray();

                res.status(200).json({
                    success: true,
                    data: jobs,
                    total,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                });
            } catch (error) {
                console.error('Error fetching microjob posts:', error);
                res.status(500).json({ success: false, message: 'Server error' });
            }
        });

        app.put('/api/microjob-status/:jobId', async (req, res) => {
            const { jobId } = req.params;
            const { status } = req.body;

            if (!["approved", "rejected"].includes(status)) {
                return res.status(400).json({ success: false, message: "Invalid status" });
            }

            try {
                const job = await microJobsPost.findOne({ _id: new ObjectId(jobId) });
                if (!job) {
                    return res.status(404).json({ success: false, message: "Job not found" });
                }

                if (job.status === status) {
                    return res.status(400).json({ success: false, message: `Job is already ${status}` });
                }

                // আপডেটের জন্য ডাটা
                let updateData = { status };

                // যদি reject হয়, তাহলে usersWallets এ ব্যালেন্স আপডেট করতে হবে
                if (status === "rejected") {
                    const amount = job.vacancy * job.price;
                    const amountWithBonus = amount + amount * 0.05; // 5% বোনাস

                    // Update usersWallets collection
                    await usersWallets.updateOne(
                        { uid: job.uid },
                        {
                            $inc: { totalBalance: amountWithBonus },
                            $setOnInsert: {
                                earningBalance: 0,
                                withdrawalBalance: 0,
                                microJobEarning: 0,
                                refererBalance: 0,
                                createdAt: new Date(),
                            }
                        },
                        { upsert: true }
                    );
                }

                // Update job status
                await microJobsPost.updateOne(
                    { _id: new ObjectId(jobId) },
                    { $set: updateData }
                );

                res.json({ success: true, message: `Job status updated to ${status}` });
            } catch (error) {
                console.error(error);
                res.status(500).json({ success: false, message: "Server error" });
            }
        });







        



        console.log("✅ Connected to MongoDB & API Ready");

        // Start server only after DB is connected
        app.listen(port, () => {
            console.log(`🚀 Bijoy server running on port ${port}`);
        });

    } catch (err) {
        console.error("❌ Failed to connect to MongoDB:", err);
    }
}

run();

// Root route
app.get('/', (req, res) => {
    res.send('✅ Bijoy Server is running');
});
