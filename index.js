require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();

// middleware
const corsOptions = {
    origin: ['http://localhost:5173'],
    credentials: true,
    optionSuccessStatus: 200,
}

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser())

app.get('/', async (req, res) => {
    res.send('AIrsenal server is running');
})
app.listen(port, () => {
    console.log(`AIrsenal is running on port: ${port}`);
});

// setup mongo Server

const verifyToken = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).send({ success: false, message: 'unAuthorize Access' })
    };
    jwt.verify(token, process.env.SECRET_ACCESS_TOKEN, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: false, message: 'Forbidden access' });
        }
        req.user = decoded;
        next();
    })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uuac6m8.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();
        // all collcetions
        const userCollcetions = client.db('AIrsenal').collection('users');

        // jwt authenication
        app.post('/jwt', async (req, res) => {
            const body = req.body;
            const token = jwt.sign(body, process.env.SECRET_ACCESS_TOKEN, { expiresIn: '365d' });
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            })
                .send({ success: true });
        })
        // logout
        app.get('/logout', async (req, res) => {
            try {
                res.clearCookie('token', {
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                })
                    .send({ success: true })
            } catch (error) {
                res.status(500).send(error);
            }
        })

        // save users in db

        app.post('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = req.body;

            // check if user exist in db
            const isExist = await userCollcetions.findOne(query);
            if (isExist) {
                return res.send(isExist);
            }
            const result = await userCollcetions.insertOne({ ...user, role: 'Customer' });
            res.send(result);
        })


        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);
