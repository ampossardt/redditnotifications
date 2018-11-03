const functions = require('firebase-functions');
const fetch = require('node-fetch');

const intervalInMinutes = 3;
const apiKey = functions.config().pushover.key;
const userId = functions.config().pushover.user;

// Configure the searches we want to do
const searchConfig = [
    { subreddit: "mechmarket", query: "selftext:(mini AND reaper)" },
    { subreddit: "mechmarket", query: "selftext:(jelly AND key AND natural AND metaphor)"},
    { subreddit: "mechmarket", query: "selftext:specter"}
];

exports.notify = functions.pubsub
  .topic('reddit-notify')
  .onPublish((message) => {
    if(!apiKey || !userId) {
        console.log("Pushover keys not configured. Exiting...");
        return false;
    }

    console.log("Starting Search...");

    for(let i = 0; i < searchConfig.length; i++) {
        executeSearch(searchConfig[i].subreddit, searchConfig[i].query);
    }

    console.log("Search finished.");
    return true;
  });

function executeSearch(subreddit, query) {
    fetch(encodeURI(`https://www.reddit.com/search.json?q=subreddit:${subreddit} ${query}&t=hour`))
        .then(response => {
            return response.json();
        })
        .then(response => {
            console.log(JSON.stringify(response));

            if(!response.data.children || !response.data.children.length) {
                console.log(`No matches found for the search query '${query}' on subreddit '${subreddit}'.`);
                return;
            }

            processResults(response);
            return false;
        })
        .catch(error => {
            console.log("Unable to get posts from reddit search API.");
            console.log(`Error: ${error}`);
        });
}

function processResults(results) {
    let matches = results.data.children;
    console.log(`${matches.length} results found for the last hour.`);
    let newMatches = matches.filter((value, index, array) => {
        return isNewMatch(value.created_utc);
    });

    for(let i = 0; i < newMatches.length; i++) {
        sendNotification(newMatches[i].subreddit, newMatches[i].title, newMatches[i].url);
    }
}

function isNewMatch(seconds) {
    var ms = seconds * 1000; // Convert to ms since that's what the reddit API gives us

    return ms && (getCurrentTimestamp() - ms < intervalInMinutes * 60 * 1000);
}

function getCurrentTimestamp() {
    let now = new Date;
    return Date.UTC(now.getUTCFullYear(),now.getUTCMonth(), now.getUTCDate() , 
      now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds(), now.getUTCMilliseconds());
}

function sendNotification(subreddit, postTitle, postLink) {
    var request = new XMLHttpRequest();
    var data = {
        token: apiKey,
        user: userId,
        title: "Reddit Search Item Found on /r/",
        message: `<b>Post title:</b> ${postTitle}`,
        url: postLink,
        url_title: "See this post"
    };

    request.open("POST", "https://api.pushover.net/1/messages.json");
    request.onreadystatechange = () => {
        if(request.readyState === 4 && request.status === 200) {
            console.log("Notification sent. Data: " + data);
        } else {
            console.log(`Unable to send Pushover notification. Error: ${request.statusText}`);
        }
    }
    request.send(data);
}