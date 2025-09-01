require('dotenv').config();
const mongoose = require('mongoose');
// This import is correct
const { faker } = require('@faker-js/faker');

// Import all models to ensure they are registered with Mongoose
const User = require('../src/models/User');
const Event = require('../src/models/Event');
const DailyMetric = require('../src/models/DailyMetric');
const PostDailyMetric = require('../src/models/PostDailyMetric');
const IdempotencyKey = require('../src/models/IdempotencyKey');

const { runDailyRollup } = require('../src/jobs/dailyRollup');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected for seeding...');
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

const seed = async () => {
    await connectDB();

    console.log('Cleaning old data...');
    await User.deleteMany({});
    await Event.deleteMany({});
    await DailyMetric.deleteMany({});
    await PostDailyMetric.deleteMany({});
    await IdempotencyKey.deleteMany({});
    console.log('Old data cleaned.');

    console.log('Seeding new data...');

    // Create users (including an admin)
    const users = [];
    const adminUser = await User.create({ username: 'admin', password: 'password123', role: 'admin' });
    users.push(adminUser);
    for (let i = 0; i < 50; i++) {
        // CORRECTED HERE: userName -> username (lowercase 'n')
        users.push(await User.create({ username: faker.internet.username(), password: 'password123' }));
    }

    const posts = Array.from({ length: 20 }, () => `post_${faker.string.alphanumeric(10)}`);
    const searchTerms = ['express tutorial', 'react hooks', 'mongodb performance', 'docker compose', 'next.js vs react'];

    const eventTypes = [
        'user_login', 'post_view', 'post_create', 'post_like', 'comment_create', 'search_performed'
    ];

    let eventsToInsert = [];
    for (let day = 60; day >= 0; day--) {
        const currentDate = new Date();
        currentDate.setDate(currentDate.getDate() - day);

        if (day % 5 === 0 && users.length < 100) {
            // CORRECTED HERE: userName -> username (lowercase 'n')
            const newUser = await User.create({ username: faker.internet.username(), password: 'password123' });
            users.push(newUser);
            eventsToInsert.push({
                event: 'user_register',
                userId: newUser._id,
                sessionId: faker.string.uuid(),
                timestamp: currentDate,
                metadata: { device: 'desktop', path: '/register' }
            });
        }

        const dailyEventsCount = faker.number.int({ min: 100, max: 500 });
        for (let i = 0; i < dailyEventsCount; i++) {
            const randomUser = faker.helpers.arrayElement(users);
            const randomPost = faker.helpers.arrayElement(posts);
            const randomEvent = faker.helpers.arrayElement(eventTypes);
            const timestamp = faker.date.between({ from: new Date(currentDate).setHours(0, 0, 0, 0), to: new Date(currentDate).setHours(23, 59, 59, 999) });

            let event = {
                event: randomEvent,
                userId: randomUser._id,
                sessionId: faker.string.uuid(),
                timestamp: timestamp,
                metadata: {
                    device: faker.helpers.arrayElement(['mobile', 'desktop', 'tablet']),
                    path: `/posts/${randomPost}`
                }
            };

            if (randomEvent.startsWith('post_') || randomEvent.startsWith('comment_')) {
                event.postId = randomPost;
            }
            if (randomEvent === 'search_performed') {
                event.metadata.query = faker.helpers.arrayElement(searchTerms);
            }
            eventsToInsert.push(event);
        }
    }

    await Event.insertMany(eventsToInsert);
    console.log(`${eventsToInsert.length} events seeded.`);

    console.log('Running initial rollup for historical data...');
    await runDailyRollup();
    console.log('Initial rollup complete.');

    console.log('Seed successful!');
    console.log('---');
    console.log('Admin user created:');
    console.log('Username: admin');
    console.log('Password: password123');
    console.log('---');

    await mongoose.connection.close();
};

seed();