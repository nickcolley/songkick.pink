require('dotenv').config()

if (!process.env.SONGKICK_API_KEY || !process.env.SERVER_IP) {
  return console.error('❗ Failed to load in the environment variables. Are they missing from the `.env` file?');
}

const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const uriPrefix = 'https://api.songkick.com/api/3.0/users';

const apiKey = process.env.SONGKICK_API_KEY;
const inDevelopment = process.env.NODE_ENV !== 'production';

let app = express();

if (inDevelopment) {
  const webpack = require('webpack');
  const devMiddleware = require('webpack-dev-middleware');
  const hotMiddleware = require('webpack-hot-middleware');
  const config = require('./webpack.config');

  const compiler = webpack(config);

  app.use(devMiddleware(compiler, {
    publicPath: config.output.publicPath,
    historyApiFallback: true
  }));

  app.use(hotMiddleware(compiler));
} else {
  // Static files
  app.use(express.static(path.resolve(path.resolve('.'), 'build')));
}

const loadData = (options) => new Promise((resolve, reject) => {
  if (!options.uri) {
    return reject('No uri');
  }

  const uri = options.uri;
  const page = options.page || 1;

  return fetch(`${uri}&page=${page}`)
    .then(response => response.json())
    .then(data => {
      if (!data.resultsPage || data.resultsPage.totalEntries <= 0) {
        return reject('No results');
      }

      const pageAmount = Math.ceil(data.resultsPage.totalEntries / data.resultsPage.perPage);

      if (data.resultsPage.page !== pageAmount) {
        return loadData({ uri, page: page + 1 })
          .then(newData => {
            if (typeof data.resultsPage.results.artist !== 'undefined') {
              data.resultsPage.results.artist = data.resultsPage.results.artist.concat(newData.resultsPage.results.artist);
            }

            if (typeof data.resultsPage.results.calendarEntry !== 'undefined') {
              data.resultsPage.results.calendarEntry = data.resultsPage.results.calendarEntry.concat(newData.resultsPage.results.calendarEntry);
            }

            return resolve(data);
          });
      }

      return resolve(data);
    })
    .catch(reject);
});

const getResults = (data) => data.resultsPage.results;

const getEvents = (data) => new Promise((resolve, reject) => {
  if (data.calendarEntry.length <= 0) {
    return reject('No events');
  }

  const events = data.calendarEntry.map(entry => {
    const event = entry.event;
    event.reason = entry.reason;
    return event;
  });

  resolve(events);
});

const getArtists = (data) => new Promise((resolve, reject) => {
  if (data.artist.length <= 0) {
    return reject('No artists');
  }

  const artists = data.artist.map(artist => {
    artist.name = artist.displayName;
    artist.image = getImage(artist);
    return artist;
  });

  resolve(artists);
});

const getImage = (data) => {
  const IMAGE_PREFIX = 'https://images.sk-static.com/images/media/profile_images';

  if (typeof data.billing !== 'undefined' ) {
    return `${IMAGE_PREFIX}/artists/${data.artist.id}/huge_avatar`;
  }

  if (typeof data.onTourUntil !== 'undefined' ) {
    return `${IMAGE_PREFIX}/artists/${data.id}/huge_avatar`;
  }

  if (data.type === 'Festival') {
    return `${IMAGE_PREFIX}/events/${data.id}/huge_avatar`;
  }

  if (data.performance && data.performance.length > 0) {
    return `${IMAGE_PREFIX}/artists/${data.performance[0].artist.id}/huge_avatar`;
  }

  return '';
};

const processPerformances = (performances) => {
  return performances.map(performance => {
    return {
      id: performance.artist.id,
      type: performance.billing,
      name: performance.artist.displayName,
      image: getImage(performance)
    };
  });
};

function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function formatDate(date, type) {
  date = date.trim(); // trim whitespace

  // if we only have the year add some time
  if (date.length === 10) {
    date += ' 00:00:00';
  }

  // replace - with /
  date = date.replace(/-/g, "/");

  // convert strings to date objects
  date = new Date(date);

  const monthNames = [
    'January', 'February', 'March',
    'April', 'May', 'June', 'July',
    'August', 'September', 'October',
    'November', 'December'
  ];

  let amPm = 'AM';
  let minutes = date.getMinutes();

  if (minutes < 10) {
    minutes = '0' + minutes;
  }

  let hours = date.getHours();

  if (hours >= 12) {
    hours -= 12;
    amPm = 'PM';
  }

  const dateString = date.toDateString();
  const dayName = dateString.split(' ')[0];
  const day = date.getDate();
  const dayWithOrdinal = `${day}${getOrdinal(day)}`;
  const monthIndex = date.getMonth();
  const month = monthNames[monthIndex];
  const year = date.getFullYear();

  if (type === 'long') {
    return `${dayName} ${dayWithOrdinal} ${month} ${year}`;
  } else if ( type === 'short') {
    return `${dayName} ${dayWithOrdinal} ${month.substr(0, 3)} `;
  } else if ( type === 'time') {
    return `${hours}:${minutes} ${amPm}`;
  }

  return dateString;
}

const processEvents = (events) => events.map(event => {
  const date = `${event.start.date} ${event.start.time || ''}`;
  const newEvent = {
    id: event.id,
    reason: event.reason,
    type: event.type.toLowerCase(),
    performances: processPerformances(event.performance),
    time: {
      iso: date,
      pretty: {
        short: date ? formatDate(date, 'short') : 'Date TBC',
        full:  date ? formatDate(date, 'long') : 'Date to be confirmed',
        doors: date ? formatDate(date, 'time') : 'Doors to be confirmed'
      }
    },
    place: {
      name: `${event.venue.displayName}, ${event.location.city}`,
      id: event.venue.id,
      uri: event.venue.uri,
      lat: event.venue.lat,
      lon: event.venue.lng
    },
    image: getImage(event),
    uri: event.uri
  };

  if (newEvent.type === 'festival') {
    newEvent.title = event.displayName;
  }

  return newEvent;
});

function sortUniqueResults(arr) {
  if (arr.length === 0) {
    return arr;
  }

  // sort by id for removing duplicates
  arr = arr.sort((a, b) => {
    return a.id - b.id;
  });

  const newArr = [arr[0]];

  for (let i = 1; i < arr.length; i++) { // start loop at 1 as element 0 can never be a duplicate
    if (arr[i - 1].id !== arr[i].id) {
      newArr.push(arr[i]);
    }
  }

  arr = newArr;

  // sort by date
  arr = arr.sort((a, b) => {
    return new Date(a.start.date) - new Date(b.start.date);
  });

  return arr;
}

function artists(username) {
  const uri = `${uriPrefix}/${username}/artists/tracked.json?apikey=${apiKey}`;
  return loadData({ uri }).then(getResults).then(getArtists);
}

function events(username) {
  return new Promise((resolve, reject) => {
    let uri = `${uriPrefix}/${username}/calendar.json?apikey=${apiKey}&reason=attendance`;
    const events = loadData({ uri }).then(getResults).then(getEvents);

    uri = `${uriPrefix}/${username}/calendar.json?apikey=${apiKey}&reason=tracked_artist`;
    const upcomingEvents = loadData({ uri }).then(getResults).then(getEvents);

    Promise.all([upcomingEvents, events]).then(results => {
      results = [].concat(...results);
      results = sortUniqueResults(results);

      resolve(processEvents(results));
    }).catch(reject);
  });
}

// allow CORS
// TODO: do i need this if im on the same domain anyway?
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

if (process.env.NODE_ENV === 'production') {
  // only allow from this ip address
  app.use(function (req, res, next) {
    if (req.ip !== process.env.SERVER_IP) { // Wrong IP address
      res.status(401);
      return res.send('Permission denied');
    }
    next(); // correct IP address, continue middleware chain
  });
}

app.get('/', function (req, res, next) {
  res.status(404).json({ error: 'No username' });
})

app.get('/events', function (req, res, next) {
  const username = req.query.username;
  if (!username) {
    return res.status(404).json({ error: 'No username' });
  }

  events(username)
    .then(data => res.json(data))
    .catch(error => res.status(500).json({ error }));
})

app.get('/artists', function (req, res) {
  const username = req.query.username;
  if (!username) {
    return res.status(404).json({ error: 'No username' });
  }

  artists(username)
    .then(data => res.json(data))
    .catch(error => res.status(500).json({ error }));
})

// Send everything else to react-router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, inDevelopment ? 'src' : 'build', 'index.html'));
});

app.listen(process.env.PORT || 8000, (err) => {
  if (err) {
    return console.error(err);
  }

  console.log(`🌐 Listening at http://localhost:${process.env.PORT || 8000}/`);
  console.log(`${inDevelopment ? '🛠 Development' : '🚀 Production'} mode`);
});
