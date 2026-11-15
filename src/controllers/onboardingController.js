const userModel = require('../models/userModel');

module.exports = {
    showStep(req, res) {
        const step = parseInt(req.params.step);
        if (step < 1 || step > 5) {
            return res.redirect('/onboarding/1');
        }

        const user = req.session.user;
        const profileData = user.profile_data || {};

        res.render('onboarding/step', { 
            step, 
            user, 
            profileData,
            error: null 
        });
    },

    async processStep(req, res) {
        const step = parseInt(req.params.step);
        const user = req.session.user;
        let profileData = user.profile_data || { goals: [], preferences: {}, products: [] };
        
        try {
            if (step === 1) {
                // Welcome step, just proceed
            } else if (step === 2) {
                // Goals
                let goals = req.body.goals || [];
                if (!Array.isArray(goals)) {
                    goals = [goals];
                }
                profileData.goals = goals;
            } else if (step === 3) {
                // Preferences
                profileData.preferences = {
                    skinConcerns: req.body.skinConcerns || '',
                    ingredientPreferences: req.body.ingredientPreferences || '',
                    budgetPreference: req.body.budgetPreference || ''
                };
            } else if (step === 4) {
                // Products
                const currentProducts = req.body.currentProducts || '';
                profileData.products = currentProducts.split(',').map(p => p.trim()).filter(p => p);
            } else if (step === 5) {
                // Privacy and Camera Consent
                if (!req.body.cameraConsent) {
                    return res.render('onboarding/step', {
                        step,
                        user,
                        profileData,
                        error: 'You must acknowledge the camera permission requirement to proceed.'
                    });
                }
                
                // Complete onboarding
                const updatedUser = await userModel.updateUser(user.id, {
                    profile_data: profileData,
                    onboarding_completed: true
                });
                
                req.session.user = updatedUser;
                return res.redirect('/app/dashboard');
            }

            // Save intermediate progress
            if (step < 5) {
                const updatedUser = await userModel.updateUser(user.id, {
                    profile_data: profileData
                });
                req.session.user = updatedUser;
                return res.redirect(`/onboarding/${step + 1}`);
            }

        } catch (error) {
            return res.render('onboarding/step', {
                step,
                user,
                profileData,
                error: 'An error occurred while saving your progress.'
            });
        }
    }
};
