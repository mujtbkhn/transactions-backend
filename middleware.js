const jwt = require('jsonwebtoken')
const { JWT_SECRET } = require('./config');



const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(403).json({
            message: 'Invalid authorization header'
        })
    }
    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        res.status(411).json({
            message: "invalid token"
        })
    }
}

module.exports = { authMiddleware }