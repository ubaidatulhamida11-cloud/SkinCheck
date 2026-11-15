const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dataFile = path.join(__dirname, '../../data/users.json');

function getUsers() {
    try {
        const data = fs.readFileSync(dataFile, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

function saveUsers(users) {
    fs.writeFileSync(dataFile, JSON.stringify(users, null, 2), 'utf8');
}

module.exports = {
    async createUser(name, email, password, phoneNumber = null, phoneVerified = false) {
        const users = getUsers();
        if (users.find(u => u.email === email)) {
            throw new Error('Email already exists');
        }
        
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        
        const newUser = {
            id: Date.now().toString(),
            name,
            email,
            password_hash,
            role: 'customer',
            status: 'active',
            phone_number: phoneNumber,
            phone_verified: phoneVerified,
            profile_data: {
                goals: [],
                preferences: {},
                products: []
            },
            onboarding_completed: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        users.push(newUser);
        saveUsers(users);
        return newUser;
    },
    
    async authenticateUser(email, password) {
        const users = getUsers();
        const user = users.find(u => u.email === email && u.status !== 'deleted');
        if (!user) return null;
        
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return null;
        
        return user;
    },
    
    getUserById(id) {
        const users = getUsers();
        return users.find(u => u.id === id);
    },

    getUserByPhone(phoneNumber) {
        if (!phoneNumber) return null;
        const users = getUsers();
        return users.find(u => u.phone_number === phoneNumber && u.status !== 'deleted') || null;
    },

    updateUserPhone(id, phoneNumber, isVerified = true) {
        const users = getUsers();
        const index = users.findIndex(u => u.id === id);
        if (index !== -1) {
            users[index].phone_number = phoneNumber;
            users[index].phone_verified = isVerified;
            users[index].updated_at = new Date().toISOString();
            saveUsers(users);
            return users[index];
        }
        return null;
    },
    
    updateUser(id, data) {
        const users = getUsers();
        const index = users.findIndex(u => u.id === id);
        if (index !== -1) {
            users[index] = { ...users[index], ...data, updated_at: new Date().toISOString() };
            saveUsers(users);
            return users[index];
        }
        return null;
    },
    
    deleteUser(id) {
        const users = getUsers();
        const index = users.findIndex(u => u.id === id);
        if (index !== -1) {
            users[index].status = 'deleted';
            users[index].email = `deleted_${id}@skincheck.local`;
            users[index].name = 'Deleted User';
            users[index].password_hash = '';
            users[index].profile_data = {};
            users[index].updated_at = new Date().toISOString();
            saveUsers(users);
            return true;
        }
        return false;
    },

    hardDeleteUser(id) {
        let users = getUsers();
        const initialLength = users.length;
        users = users.filter(u => u.id !== id);
        if (users.length !== initialLength) {
            saveUsers(users);
            return true;
        }
        return false;
    },

    getAllUsers() {
        return getUsers();
    },

    getUserStatistics() {
        const users = getUsers();
        const stats = {
            total: users.length,
            active: 0,
            deleted: 0,
            roles: {},
            usersList: users.map(u => ({
                id: u.id,
                name: u.name,
                email: u.email,
                role: u.role || 'customer',
                status: u.status || 'active'
            }))
        };

        users.forEach(u => {
            if (u.status === 'deleted') {
                stats.deleted++;
            } else {
                stats.active++;
            }
            const role = (u.role || 'customer').toLowerCase();
            stats.roles[role] = (stats.roles[role] || 0) + 1;
        });

        return stats;
    }
};
