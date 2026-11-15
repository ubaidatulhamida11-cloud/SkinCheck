module.exports = {
    requireAuth(req, res, next) {
        if (!req.session.user) {
            return res.redirect('/auth/login');
        }
        next();
    },

    requireAdmin(req, res, next) {
        if (!req.session.user) {
            if (req.xhr || req.headers.accept?.includes('json') || req.is('json')) {
                return res.status(401).json({ success: false, message: 'Autentikasi diperlukan. Silakan login kembali.' });
            }
            return res.redirect('/auth/login');
        }
        if (req.session.user.role !== 'admin' && req.session.user.role !== 'superadmin') {
            if (req.xhr || req.headers.accept?.includes('json') || req.is('json')) {
                return res.status(403).json({ success: false, message: 'Akses ditolak: Membutuhkan izin administrator.' });
            }
            return res.redirect('/app/dashboard');
        }
        next();
    },

    requireSuperAdmin(req, res, next) {
        if (!req.session.user) {
            if (req.xhr || req.headers.accept?.includes('json') || req.is('json')) {
                return res.status(401).json({ success: false, message: 'Sesi kedaluwarsa. Silakan login kembali.' });
            }
            return res.redirect('/auth/login');
        }
        const role = (req.session.user.role || '').toLowerCase();
        const isSuper = role === 'admin' || role === 'superadmin' || Boolean(req.session.user.is_superadmin);
        if (!isSuper) {
            if (req.xhr || req.headers.accept?.includes('json') || req.is('json')) {
                return res.status(403).json({ success: false, message: 'Akses ditolak: Menu konfigurasi sistem hanya dapat diakses oleh Super Admin.' });
            }
            return res.status(403).send('Akses Ditolak: Anda tidak memiliki izin Super Admin untuk mengakses konfigurasi sistem.');
        }
        next();
    },

    requireOnboarding(req, res, next) {
        if (!req.session.user) {
            return res.redirect('/auth/login');
        }
        if (req.session.user.role === 'admin') {
            return next();
        }
        if (!req.session.user.onboarding_completed) {
            return res.redirect('/onboarding/1');
        }
        next();
    },

    requireGuest(req, res, next) {
        if (req.session.user) {
            if (req.session.user.role === 'admin') {
                return res.redirect('/admin/dashboard');
            }
            if (!req.session.user.onboarding_completed) {
                return res.redirect('/onboarding/1');
            }
            return res.redirect('/app/dashboard');
        }
        next();
    }
};
