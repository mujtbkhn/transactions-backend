const express = require('express')
const zod = require('zod');
const { User, Account } = require('../db');
const jwt = require('jsonwebtoken');
const { authMiddleware } = require('../middleware');
const { JWT_SECRET } = require('../config');
const router = express.Router();
const bcrypt = require("bcrypt")

const signUpValidation = zod.object({
    username: zod.string().email(),
    password: zod.string(),
    firstName: zod.string(),
    lastName: zod.string(),
})
router.post('/signup', async (req, res) => {
    const {username, password, firstName, lastName} = req.body
    const { success } = signUpValidation.safeParse(req.body)
    if (!success) {
        return res.status(400).json({
            message: "Wrong inputs"
        })
    }
    const existingUser = await User.findOne({
        username: req.body.username
    })
    if (existingUser) {
        return res.status(400).json({
            message: "Email already taken"
        })
    }

    // const hashedPassword = await bcrypt.hash(password, 10)

    const user = await User.create({
        username: username,
        password: password,
        firstName: firstName,
        lastName: lastName,
    })

    const userId = user._id

    await Account.create({
        userId,
        balance: 1 + Math.random() * 10000
    })

    const token = jwt.sign({
        userId
    }, JWT_SECRET)


    res.json({
        message: "User created successfully",
        token: token
    })
})
const signInValidation = zod.object({
    username: zod.string().email(),
    password: zod.string()
})
router.post('/signin', async (req, res) => {
    const { password } = req.body
    const { success } = signInValidation.safeParse(req.body)
    if (!success) {
        return res.status(400).json({
            message: "Error while logging in for parsing"
        })
    }
    const user = await User.findOne({
        username: req.body.username,
    });

    if(!user){
        return res.status(400).json({
            message: "Incorrect username"
        })
    }

    // const passwordMatch = await bcrypt.compare(
    //     password,
    //     user.password
    // )
    // if(!passwordMatch){
    //     return res.status(401).json({
    //         message: "Incorrect password"
    //     })
    // }
    if (user) {
        const token = jwt.sign({
            userId: user._id
        }, JWT_SECRET)
        res.json({
            token
        })
        return;
    }
    res.status(400).json({
        message: "Error while logging in"
    })
})

const updateValidation = zod.object({
    password: zod.string().optional(),
    firstName: zod.string().optional(),
    lastName: zod.string().optional()

})
router.put('/', authMiddleware, async (req, res) => {

    const { success } = updateValidation.safeParse(req.body);
    if (!success) {
        res.status(411).json({
            message: "Invalid inputs"
        })
    }
    await User.updateOne(req.body, {
        id: req.userId
    })

    res.json({
        message: "Updated successfully"
    })

})  

router.get('/bulk', async (req, res) => {

    const filter = req.query.filter || '';

    const users = await User.find({
        $or: [{
            'firstName': {
                '$regex': filter
            }
        },
        {
            'lastName': {
                '$regex': filter
            }
        }]

    })


    res.json({
        user: users.map(user => ({
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            _id: user._id
        }))
    })
})
module.exports = router; 