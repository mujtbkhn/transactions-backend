const express = require('express');
const { authMiddleware } = require('../middleware');
const { Account, Transaction } = require('../db');
const mongoose = require('mongoose')
const router = express.Router();

router.get('/balance', authMiddleware, async (req, res) => {
    const account = await Account.findOne({
        userId: req.userId
    })

    res.json({
        balance: account.balance
    })

})

router.post('/addBalance', authMiddleware, async (req, res) => {
    const account = await Account.findOne({
        userId: req.userId
    })
    let balance = account.balance
    if (balance >= 4500) {
        res.status(411).json({
            message: "amount more than 2500"
        })
    } else {

        balance += Math.random() * 1000
        await Account.updateOne({ userId: req.userId }, { balance })
    }
    res.status(200).json({
        balance,
        message: `${balance}$ added to your account`
    })
})
router.get('/transactions', authMiddleware, async (req, res) => {
    try {
        const account = await Account.findOne({ userId: req.userId }).populate({
            path: 'transactions',
            populate: {
                path: 'to',
                select: 'firstName lastName' // Only select firstName and lastName
            },
            options: { sort: { timestamp: -1 }, limit: 10 }
        });

        if (!account) throw new Error('Account not found');

        const transactionsWithNames = account.transactions.map(transaction => ({
            _id: transaction._id,
            from: transaction.from,
            to: transaction.to, // Populate the to field directly
            amount: transaction.amount,
            timestamp: transaction.timestamp,
            __v: transaction.__v
        }));

        res.json({ transactions: transactionsWithNames, message: "successful" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});



router.post('/transfer', authMiddleware, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { amount, to } = req.body;
        const senderAccountId = req.userId;
        const receiverAccountId = to; // Assuming to contains the receiver's account ID

        // Log the senderAccountId and receiverAccountId to ensure they are received correctly
        console.log('Sender Account ID:', senderAccountId);
        console.log('Receiver Account ID:', receiverAccountId);

        const senderAccount = await Account.findOne({ userId: senderAccountId }).session(session);
        const receiverAccount = await Account.findOne({ userId: receiverAccountId }).session(session);

        // Log the senderAccount and receiverAccount to ensure they are retrieved correctly
        console.log('Sender Account:', senderAccount);
        console.log('Receiver Account:', receiverAccount);

        // Check if receiverAccount is found
        if (!receiverAccount) {
            await session.abortTransaction()
            return res.status(404).json({ message: "Receiver account not found" });
        }

        if (!senderAccount || senderAccount.balance < amount) {
            await session.abortTransaction()
            return res.status(404).json({ message: "Insufficient balance" })
        }

        senderAccount.balance -= amount;
        receiverAccount.balance += amount;

        await senderAccount.save();
        await receiverAccount.save();

        // Create a new transaction
        const transaction = new Transaction({ 
            from: senderAccountId, // Assign the sender's account ID
            to: receiverAccount.userId, // Assign the receiver's user ID, not account ID
            amount 
        });

        await transaction.save();

        senderAccount.transactions.push(transaction._id);
        receiverAccount.transactions.push(transaction._id);

        await senderAccount.save();
        await receiverAccount.save();

        await session.commitTransaction();
        res.json({ message: "Transfer Successfully done" })
    } catch (error) {
        await session.abortTransaction()
        res.status(500).json({ message: error.message })
    } finally {
        session.endSession()
    }
});





module.exports = router;