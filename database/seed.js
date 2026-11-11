// Run this via: node database/seed.js
const pool = require('../src/config/db');
const bcrypt = require('bcrypt');

async function seedDatabase() {
    try {
        console.log('Starting database seeding...');

        // 1. Insert Roles
        await pool.query(`
            INSERT IGNORE INTO roles (name) VALUES 
            ('Super Admin'), ('Administrator'), ('Teacher'), ('Student')
        `);

        // 2. Create Default Super Admin
        const adminEmail = 'admin@edumanage.com';
        const adminPassword = 'Admin@123';
        const saltRounds = 10;

        const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);

        // Check if admin exists
        const [existingAdmin] = await pool.query('SELECT * FROM users WHERE email = ?', [adminEmail]);

        if (existingAdmin.length === 0) {
            // Get Super Admin role ID
            const [role] = await pool.query('SELECT id FROM roles WHERE name = "Super Admin"');

            await pool.query(
                'INSERT INTO users (role_id, email, password_hash) VALUES (?, ?, ?)',
                [role[0].id, adminEmail, hashedPassword]
            );
            console.log(`✅ Super Admin created. Email: ${adminEmail}, Password: ${adminPassword}`);
        } else {
            console.log('ℹ️ Super Admin already exists. Skipping.');
        }

        console.log('✅ Seeding completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
}

seedDatabase();