import { join } from 'path';
import express from 'express';
import jwt from 'express-jwt';
import graphql from 'express-graphql';
import socket from 'socket.io';
import amqp from 'amqplib';
import mongoose from 'mongoose';
import history from 'express-history-api-fallback';
import compression from 'compression';
import cors from 'cors';
import morgan from 'morgan';
import bodyParser from 'body-parser';

import routes from './rest';
import schema from './graphql';

const app = express();

/**
 * @name config
 */
app.set('port', (process.env.PORT || 3000));
app.set('mongodb-uri', (process.env.MONGODB_URI || 'mongodb://web-go:web-go@ds133961.mlab.com:33961/web-go-demo'));
app.set('secret', process.env.SECRET || 'webgo');

/**
 * @name middleware
 */
app.use(compression());
app.use(cors());
app.use(morgan('tiny'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(jwt({ secret: Buffer.from(app.get('secret'), 'base64'), credentialsRequired: false }));

/**
 * @name REST
 */
app.use(routes);

/**
 * @name GraphQL
 */
app.use('/__/graphql', graphql(() => ({
  schema,
  graphiql: process.env.NODE_ENV !== 'production',
  pretty: process.env.NODE_ENV !== 'production'
})));

/**
 * @name static
 */
if (process.env.NODE_ENV === 'production') {
  const root = join(__dirname, '../public');

  app.use(express.static(root));
  app.use(history('index.html', { root }));
}

/**
 * @name server
 */
const server = app.listen(app.get('port'), (): void => {
  console.log(' [*] App: Bootstrap Succeeded.');
  console.log(` [*] Port: ${app.get('port')}.`);
});

/**
 * @name database
 */
mongoose.connect(app.get('mongodb-uri'));
mongoose.connection.on('error', console.error.bind(console, 'connection error:'));
mongoose.connection.once('open', () => console.log(' [*] DB: Connection Succeeded.'));

/**
 * @name Socket
 */
const io = socket.listen(server);

io.on('connection', socket => {
  console.log('WS: Establish a connection.');
  socket.on('disconnect', () => console.log('WS: Disconnected.'));

  socket.emit('A', { foo: 'bar' });
  socket.on('B', data => console.log(data));
});

/**
 * @name RabbitMQ
 */
const rabbitmqUri = 'amqp://gnnwevxx:V1PhfxZSO_-CJ6agZGipEBVmFX508N0P@black-boar.rmq.cloudamqp.com/gnnwevxx';

amqp.connect(rabbitmqUri)
  .then(conn => {
    return conn.createChannel()
      .then(channel => {
        const queue = 'foo';
        const message = 'Hello World!';

        const ok = channel.assertQueue(queue, { durable: false });

        return ok.then(() => {
          channel.sendToQueue(queue, Buffer.from(message));
          console.log(message);

          return channel.close();
        });
      })
      .finally(() => conn.close());
  })
  .catch(console.warn);

export default server;
