require('dotenv').config();

const express = require("express");
const cors = require('cors')
const apiRouter = require('./routes/index');

const app = express();

app.use(cors())
app.use(express.json());

app.use('/api/v1', apiRouter)

app.listen(3000, () => {
    console.log('running');
})
