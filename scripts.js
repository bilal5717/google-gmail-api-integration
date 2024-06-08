/* exported gisLoaded */
/* exported handleAuthClick */
/* exported handleSignoutClick */

// TODO(developer): Set to client ID and API key from the Developer Console
const CLIENT_ID = '';//TODO
const API_KEY = '';//TODO

// Discovery doc URL for APIs used by the quickstart
const DISCOVERY_DOC = [
    "https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest",
    "https://www.googleapis.com/discovery/v1/apis/people/v1/rest"
  ];

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/directory.readonly';

let tokenClient;
let gapiInited = false;
let gisInited = false;
let timelineView = true;
var sampleTimeLIneEntry = null;
let senderImages = {};
var recipientEmails = [];

var timelineLoader = $("#timeline-loader");
var timelineLoadMore = $("#loadmore-conversation");

var mailsTimelineSampleList = $("#sample-inbox-timeline");
var inboxTimelineLoader = $(".inbox-timeline-loader");
var inboxTimelineLoadMore = $(".inboxTimelineLoadmore");
var currentFolder = "inbox";


var mailsTimelineSampleList = $("#sample-inbox-timeline");


//Render full message body here, also prevent from being disturbed by child styles
const shadowRoot = document.getElementById('full-message-container').attachShadow({ mode: 'open' });

//WHich sender is selected
var conversationFrom = "";
var conversationNextPage = null;
var inboxTimelineNextPage = null;

//Months list for date formate
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Callback after api.js is loaded.
 */
function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

/**
 * Callback after the API client is loaded. Loads the
 * discovery doc to initialize the API.
 */
async function initializeGapiClient() {
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: DISCOVERY_DOC,
    });
    gapiInited = true;
    maybeEnableButtons();
}

/**
 * Callback after Google Identity Services are loaded.
 */
function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // defined later
    });
    gisInited = true;
    maybeEnableButtons();
}

/**
 * Enables user interaction after all libraries are loaded.
 */
function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        sampleTimeLIneEntry = $('#sample-timeline-entry');

        // Load inbox if already authenticated
        preAuthCheck();
        
        //Load jQuery events
        loadJqueryEvents();
    }
}

// Load inbox if already authenticated
function preAuthCheck() {
    let access_token = localStorage.getItem("access_token");
    if (access_token !== undefined && access_token !== '') {
        gapi.client.setToken({ access_token: access_token });
    }
    if (gapi.client.getToken() !== null) {
        console.log("requestAccessToken");
        $("#authorize_button").trigger("click");

    }
}

/**
 *  Sign in the user upon button click.
 */
function handleAuthClick() {
    tokenClient.callback = async (resp) => {
        console.log("handleAuthClick resp: ", resp);

        if (resp.error !== undefined) {
            throw (resp);
        }

        if (resp.access_token) {
            localStorage.setItem("access_token", resp.access_token);
        }

        if (resp.refresh_token !== undefined) {
            localStorage.setItem("refresh_token", resp.refresh_token);
        }

        document.getElementById('signout_button').style.visibility = 'visible';
        document.getElementById('authorize_button').innerText = 'Refresh';

        //await listLabels();
        //getLabelCount('me', 'label:inbox');
        //listEmails();

        inboxTimeline();
        getUserProfileImage();
    };


    if (gapi.client.getToken() === null) {
        console.log("requestAccessToken consent");
        // Prompt the user to select a Google Account and ask for consent to share their data
        // when establishing a new session.
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        // Skip display of account chooser and consent dialog for an existing session.
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

/**
 *  Sign out the user upon button click.
 */
function handleSignoutClick() {
    localStorage.removeItem("access_token");

    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        setTimeout(function () {
            window.location.reload();
         }, 1000);
    }
}


/**
 * #####################################
 * ### Main Iibox Timeline Functions ###
 * #####################################
 */

/**
 * Print all Labels in the authorized user's inbox. If no labels
 * are found an appropriate message is printed.
 */
var labels = [];
async function listLabels() {
    let response;
    try {
        response = await gapi.client.gmail.users.labels.list({
            'userId': 'me',
        });
        console.log("labels response: ",response);
    } catch (error) {
        console.log('Error response:  ' + error);
        if (error.status == 401) {
            localStorage.removeItem("access_token");
            handleAuthClick();
            return;
        }
    }
    const labels = response.result.labels;
    if (!labels || labels.length == 0) {
        labels = [];
        return;
    }
    // Flatten to string to display
    const output = labels.reduce(
        (str, label) => `${str}${label.name}\n`,
        'Labels:\n');

    labels.push = output;
}

function getLabelCount(userId, labelId) {
    response = gapi.client.gmail.users.labels.list({
        'userId': userId,
        'id': labelId
    });
    console.log("labels getLabelCount: ",response.result.messagesTotal);
  }

// List emails for inbox in list view
// List emails for inbox in list view
function inboxTimeline(folder = 'inbox', mailsNextPageToken = null, searchQuery = null) {
    
    // Clear the current email list if folder is different
    if (currentFolder != folder || searchQuery) {
        $('.inbox-timeline').empty();
    }
    
    currentFolder = folder;
    inboxTimelineLoader.show();
    inboxTimelineLoadMore.hide();
    let query = 'label:' + folder;

    if (searchQuery) {
        query = query + ' ' + searchQuery;
    }
    
    // Make a request to list emails
    var options = {
        'userId': 'me',
        'maxResults': 25,
        'q': query
    };

    if (mailsNextPageToken) {
        options.pageToken = mailsNextPageToken;
    }

    gapi.client.gmail.users.messages.list(options).then(function (response) {
        var emails = response.result.messages;

        if (response.result.nextPageToken) {
            inboxTimelineNextPage = response.result.nextPageToken; // Update next page token
            inboxTimelineLoadMore.show();
        } else {
            inboxTimelineNextPage = null; // Reset next page token if no more pages
            inboxTimelineLoadMore.hide();
        }

        if (emails && emails.length > 0) {
            var messagePromises = emails.map(email => gapi.client.gmail.users.messages.get({
                'userId': 'me',
                'id': email.id
            }));

            Promise.all(messagePromises).then(function (responses) {
                // Sort messages by internalDate
                var sortedMessages = responses.sort((a, b) => {
                    return new Date(parseInt(b.result.internalDate)) - new Date(parseInt(a.result.internalDate));
                });

                sortedMessages.forEach(response => prepareInboxTimelineItem(response, folder));

                inboxTimelineLoader.hide();
            });
        } else {
            // No emails found
            $('.inbox-timeline').append('<li>No emails found</li>');
            inboxTimelineLoader.hide();
        }
    }, function (error) {
        // Handle error
        console.log('Error response:  ' + error);
        if (error.status == 401) {
            localStorage.removeItem("access_token");
            handleAuthClick();
            return;
        }
    });
}

function prepareInboxTimelineItem(response) {
    let newListItem = $($.parseHTML($("#sample-inbox-timeline").html()));

    let snippet = response.result.snippet;
    if (snippet.length > 80) {
        snippet = snippet.substring(0, 80) + "...";
    }

    let headers = getCustomizedHeaders(response.result.payload.headers);
    const date = new Date(headers["Date"]);
    let dateString = months[date.getMonth()] + " " + date.getDate() + "<sup>th</sup>";
    let hours = date.getHours();
    let minutes = date.getMinutes();
    let ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // Handle midnight
    minutes = minutes < 10 ? '0' + minutes : minutes; // Add leading zero to minutes
    let timeString = hours + ':' + minutes + ' ' + ampm;

    if (response.result.labelIds.includes('UNREAD')) {
        newListItem.css('background-color', '#d0d9e1');
    }
    if (response.result.labelIds.includes('STARRED')) {
        newListItem.find('.svg-images').parent().addClass('starred'); // Add class to parent span
    }

    newListItem.attr("onclick", "listUserEmails('"+headers["From"]+"')");
    newListItem.find('div.title').html(headers["Subject"]);
    if (headers["To"]) {
        newListItem.find('div.To').html("To: " + headers["To"]); // Display To field if it exists
    } else {
        newListItem.find('div.To').html(""); // Clear the To field if it doesn't exist
    }
    newListItem.find('div.info').html(snippet);

    let senderName = headers["From"];
    let senderWords = senderName.split(' ');
    if (senderWords.length > 3) {
        senderName = senderWords.slice(0, 3).join(' ') + "...";
    }

    newListItem.find('div.name').html("- " + senderName + " -");
    newListItem.find('div.time .dateString').html(dateString);
    newListItem.find('div.time .timeString').html(timeString);

    // Add hover event to show the snippet to the entire component
    newListItem.hover(
        function() {
            $(this).find('.info-container').show();
        }, 
        function() {
            $(this).find('.info-container').hide();
        }
    );

    // Handle star icon click event
    newListItem.find('.star-icon').on('click', function(event) {
        event.stopPropagation(); // Prevent the click from propagating to the parent

        let starIconParent = $(this).parent();
        let isStarred = starIconParent.find('.svg-images').parent().hasClass('starred');
        
        if (isStarred) {
            starIconParent.find('.svg-images').parent().removeClass('starred');
            // Call API to unstar the email
            unstarEmail(response.result.id);
        } else {
            starIconParent.find('.svg-images').parent().addClass('starred');
            // Call API to star the email
            starEmail(response.result.id);
        }
    });

    $(".inbox-timeline").append(newListItem);
}

// Function to star an email using the Gmail API
function starEmail(emailId) {
    gapi.client.gmail.users.messages.modify({
        userId: 'me',
        id: emailId,
        addLabelIds: ['STARRED']
    }).then(function(response) {
        console.log("Email starred successfully");
    }).catch(function(error) {
        console.error("Error starring email: ", error);
    });
}

// Function to unstar an email using the Gmail API
function unstarEmail(emailId) {
    gapi.client.gmail.users.messages.modify({
        userId: 'me',
        id: emailId,
        removeLabelIds: ['STARRED']
    }).then(function(response) {
        console.log("Email unstarred successfully");
    }).catch(function(error) {
        console.error("Error unstarring email: ", error);
    });
}


// This function hide and show timeline view
function toogleConversation(type = "show") {
    if (type == "show") {
        timelineLoader.show();
        $(".inbox-timeline-container").hide();
        $(".conversation").show();
        $("#conversation-messages-all").show();
        $("#conversation-full-message").hide();
    } else {
        $(".inbox-timeline-container").show();
        $(".conversation").hide();
        timelineLoader.hide();
        $("#conversation-full-message").hide();

    }
}

// reply  to sender

$(document).ready(function(){
    $(".reply-container").hide(); // Hide the reply container by default

    // Toggle the visibility of the reply container when clicking the reply button
    $("#reply-button").click(function(){
        $(".reply-container").toggle(); 
    });

    // Close the reply container when clicking the close button
    $("#close").click(function(){
        $(".reply-container").hide(); 
    });

    // Minimize the reply container when clicking the minimize button
    $("#minimize").click(function(){
        $(".reply-container").slideToggle(); 
    });
    $("#add-sender").click(function(){
        var inputField = '<input type="text" class="manual-recipient" placeholder="Recipient Email">';
        $(".reply-body").children().first().before(inputField);
    });
    $("#reply-btn").click(function(){
        var emailBody = $(".reply-body textarea").val();
        
        $(".manual-recipient").each(function(){
            var email = $(this).val().trim();
            if(email !== "") {
                recipientEmails.push(email);
            }
        });

        // Create the email message
        var email = {
            'raw': window.btoa("To: " + recipientEmails.join(", ") + "\r\n" +
                               "Subject: Subject of the email\r\n\r\n" +
                               emailBody)
        };

        // Call the Gmail API to send the email
        gapi.client.gmail.users.messages.send({
            'userId': 'me',
            'resource': email
        }).then(function(response) {
            // Handle successful response
            console.log('Email sent: ', response);
            // Optionally, show a success message to the user
        }, function(error) {
            // Handle error
            console.error('Error sending email: ', error);
            // Optionally, show an error message to the user
        });

        // Clear input fields after sending
        $(".reply-body textarea").val("");
        // Clear manual recipient inputs
        $(".manual-recipient").remove();
        // Optionally, hide the reply UI after sending
        $(".reply-container").hide();
    });
});



/**
 * #######################################
 * ### Conversation Timeline Functions ###
 * #######################################
 */

/**
 * Load a conversation
 * When click on the single email item from the list, it loads all time conversation from that user
 * me: is as my email or user who is authenticated
 * query: parameter is here to recognize the sender and receiver as the single person
 * nextPageToken: is used if there are more conversations in the list more then the sepecified maxResults:25 results
 */


function listUserEmails(senderString, nextPageToken = null) {
    timelineLoader.show();
    timelineLoadMore.hide();
    let sender = getemailFromSender(senderString);

    // For reply function
    recipientEmails = [sender];

    // Check if not loading more conversation then open a fresh screen
    if (!nextPageToken) {
        toogleConversation("show");
        $(".centered-timeline").html("");
    }

    // Construct query to fetch emails involving the specified sender
    var query = 'from:' + sender + ' OR to:' + sender;

    let option = {
        'userId': 'me',
        'q': query,
        'maxResults': 50
    };

    if (nextPageToken) {
        option.pageToken = nextPageToken;
    }

    // Array to hold the full message details
    let allMessages = [];

    // Make a request to list emails
    gapi.client.gmail.users.messages.list(option).then(function (response) {
        var messages = response.result.messages || [];

        // For load more purpose
        conversationFrom = sender;
        conversationNextPage = response.result.nextPageToken ?? null;

        // Show timeline load more button if next page token exists
        if (response.result.nextPageToken) {
            timelineLoadMore.show();
        } else {
            timelineLoadMore.hide();
        }

        if (messages.length > 0) {
            // Fetch details for each message and store them in allMessages array
            
            let messagePromises = messages.map(function (message) {
                return gapi.client.gmail.users.messages.get({
                    'userId': 'me',
                    'id': message.id
                }).then(function (response) {
                    allMessages.push(response.result);
                });
            });

            // Wait for all messages to be fetched
            Promise.all(messagePromises).then(function () {
                // Sort messages by internalDate in descending order
                allMessages.sort((a, b) => b.internalDate - a.internalDate);

                // Process and display sorted messages
                allMessages.forEach(function (message) {
                    // Prepare all conversation messages in the timeline screen
                    prepareCenterdTimelineItem(message);
                    let senderEmail = getemailFromSender(message.payload.headers.find(header => header.name === "From").value);
                  //  getSenderProfileImage(senderEmail, message.id);
                });

                timelineLoader.hide();
            });
        } else {
            // No messages found
            console.log('No messages found from sender ' + sender);
            timelineLoader.hide();
        }
    }, function (error) {
        // Handle error
        console.log('Error response:  ' + error);

        if (error.status == 401) {
            localStorage.removeItem("access_token");
            handleAuthClick();
            return;
        }
    });
}


// This funcion will prepare conversation messages inside the timeline screen
// Not in used 
function prepareTimelineItems(responseResult) {
    var newTimeLineEntry = $($.parseHTML($("#sample-timeline-entry").html()));

    // Process the full message details
    let snippet = responseResult.snippet;
    let internalDate = responseResult.internalDate;
    let headers = getCustomizedHeaders(responseResult.payload.headers);

    if (responseResult.labelIds.includes("SENT")) {
        newTimeLineEntry.find('.title').addClass("my-message");
    }
    newTimeLineEntry.attr("id", internalDate);
    newTimeLineEntry.find('.title > h3').html(headers["Date"]);
    newTimeLineEntry.find('.title > p').html(headers["From"]);
    newTimeLineEntry.find('.body > p').html(headers["Subject"]);
    newTimeLineEntry.find('.body > ul > li').html(snippet);

    // Add smooth hover effect
    newTimeLineEntry.hover(
        function() {
            $(this).addClass('hovered');
        }, 
        function() {
            $(this).removeClass('hovered');
        }
    );

    $(".timeline").append(newTimeLineEntry);
}


function prepareCenterdTimelineItem(responseResult) {
    var newTimeLineEntry = $($.parseHTML($("#sample-timeline-entry").html()));

    // Process the full message details
    let snippet = responseResult.snippet;
    let internalDate = responseResult.internalDate;
    let headers = getCustomizedHeaders(responseResult.payload.headers);

    // Check if the email is unread and add an exclamation mark symbol
    if (!responseResult.labelIds.includes("UNREAD")) {
        newTimeLineEntry.find('.timeline-content').prepend('<span class="read-status">!</span>');
    }

    if (responseResult.labelIds.includes("SENT")) {
        newTimeLineEntry.removeClass("timeline-block-left");
        newTimeLineEntry.addClass("timeline-block-right");
    }

    const date = new Date(headers["Date"]);
    let dateString = months[date.getMonth()] + " " + date.getDate() + "<sup>th</sup>";
    let timeString = date.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });

    newTimeLineEntry.attr("id", responseResult.id);
    newTimeLineEntry.find('.timeline-content > h3 > .dateString').html(dateString);
    newTimeLineEntry.find('.timeline-content > h3 > .timeString').html(timeString);
    newTimeLineEntry.find('.timeline-content > .spanTagline').html(headers["From"] + ": " + headers["Subject"]);
    newTimeLineEntry.find('.timeline-content > p').html(snippet);
    newTimeLineEntry.find('.timeline-content > a.read-full-message').attr("onclick", "loadSingleMessageBody('" + responseResult.id + "')");

    // Hide the snippet by default
    newTimeLineEntry.find('.timeline-content > p').hide();

    // Add hover event to show the snippet
    newTimeLineEntry.hover(
        function () {
            $(this).find('.timeline-content > p').show();
        },
        function () {
            $(this).find('.timeline-content > p').hide();
        }
    );

    // Extract the email address from the sender string and fetch the sender's profile image
    let senderEmail = getemailFromSender(headers["From"]);
    getSenderProfileImage(senderEmail, newTimeLineEntry);

    // Append the new timeline entry to the centered timeline container
    $(".centered-timeline").append(newTimeLineEntry);
}

function getUserProfileImage() {
    
    gapi.client.people.people.get({
      resourceName: 'people/me',
      personFields: 'photos'
    }).then(function(response) {
        
        if (response.result.photos && response.result.photos.length > 0) { 
            var profileImageUrl = response.result.photos[0].url;
            $('#profile-image img').attr("src", profileImageUrl);
        }
        
    }, function(error) {
      console.error('Error retrieving profile image:', error);
    });
}

function getSenderProfileImage(senderEmail, element) {
    gapi.client.gmail.users.messages.list({
        userId: 'me',
        maxResults: 1,
        q: 'from:' + senderEmail
    }).then(function(response) {
        if (response.result.messages && response.result.messages.length > 0) {
            var messageId = response.result.messages[0].id;

            gapi.client.gmail.users.messages.get({
                userId: 'me',
                id: messageId,
                format: 'metadata'
            }).then(function(response) {
                var headers = response.result.payload.headers;
                var sender;
                for (var i = 0; i < headers.length; i++) {
                    if (headers[i].name === 'From') {
                        sender = headers[i].value;
                        break;
                    }
                }
                if (sender) {
                    var senderEmail = sender.match(/<(.*?)>/)[1].trim(); // Extract sender email from format: "Sender Name <sender@example.com>"
                    
                    gapi.client.people.people.searchDirectoryPeople({
                        query: senderEmail,
                        readMask: 'photos',
                        sources: ['DIRECTORY_SOURCE_TYPE_DOMAIN_CONTACT']
                    }).then(function(response) {
                        if (response.result.people && response.result.people.length > 0) {
                            var person = response.result.people[0];
                            if (person.photos && person.photos.length > 0) {
                                var profileImageUrl = person.photos[0].url;
                                element.find('.profile-picture').attr("src", profileImageUrl);
                            } else {
                                console.log('No photos found for the sender.');
                            }
                        } else {
                            console.log('No directory information found for the sender.');
                        }
                    }, function(error) {
                        console.error('Error retrieving directory information:', error);
                    });
                } else {
                    console.log('Sender information not found.');
                }
            }, function(error) {
                console.error('Error retrieving message:', error);
            });
        } else {
            console.log('No messages found from the sender.');
        }
    }, function(error) {
        console.error('Error retrieving messages list:', error);
    });
}







 // Output: noreply@linkedin.com


function getemailFromSender(sender) {
    // Extract email from the sender string
    const emailMatch = sender.match(/<([^>]+)>/);
    return emailMatch ? emailMatch[1] : sender;
}




/**
 * ################
 * Search Function
 * ################
 */

// Add event listener for search button click
$('#search-button').click(function() {
    performSearch();
});

// Add event listener for pressing Enter key in search input field
$('#search-input').keypress(function(event) {
    // Check if Enter key is pressed (key code 13)
    if (event.which === 13) {
        performSearch();
    }
});

// Function to perform search
function performSearch() {
    let searchQuery = $('#search-input').val().trim();
    if (searchQuery !== '') {
        console.log("searchQuery: ",searchQuery);
        inboxTimeline(currentFolder, null, searchQuery);
    } else {
        // If search query is empty, display all emails
        inboxTimeline(currentFolder, null);
    }
}

// Function to clear existing email list
function clearEmailList() {
    $('.inbox-timeline').empty();
}

// Composition messege sender
$(document).ready(function(){
    $(".compose-container").hide();

    // Toggle the visibility of the compose container when clicking the COMPOSE button
    $(".compose-button").click(function(){
        $(".compose-container").toggle();
    });

    // Close the compose container when clicking the close button
    $(".close").click(function(){
        $(".compose-container").hide();
    });

    // Minimize the compose container when clicking the minimize button
    $(".minimize").click(function(){
        $(".compose-body").slideToggle();
    });

    // Send email functionality using Gmail API
    $(".send-button").click(function(){
        // Collect input values from the compose form
        var to = $("#to").val().trim(); // Trim leading/trailing spaces
        var subject = $("#subject").val().trim();
        var emailBody = $("#email-body").val().trim();

        // Check if recipient email address is provided
        if (!to) {
            alert("Recipient email address is required.");
            return;
        }

        // Create the email message
        var email = {
            'raw': window.btoa("To: " + to + "\r\n" +
                               "Subject: " + subject + "\r\n\r\n" +
                               emailBody)
        };

        // Call the Gmail API to send the email
        gapi.client.gmail.users.messages.send({
            'userId': 'me',
            'resource': email
        }).then(function(response) {
            // Handle successful response
            console.log('Email sent: ', response);
            alert("Email sent successfully!");
        }).catch(function(error) {
            // Handle error
            console.error('Error sending email: ', error);
            alert("Failed to send email. Please try again later.");
        });

        // Clear input fields after sending
        $("#to, #subject, #email-body").val("");
        // Optionally, hide the composition UI after sending
        $(".compose-container").hide();
    });
});


/**
 * ################
 * Helper Functions
 * ################
 */

// Reterive only the required headers like date, from name or subject etc.
function getCustomizedHeaders(headers) {
    let myHeaders = ['Date', "From", "Subject"];
    let headResponse = {};
    myHeaders.forEach(header => {
        headResponse[header] = "";
        for (let index = 0; index < headers.length; index++) {
            if (headers[index].name === header) {
                headResponse[header] = headers[index].value;
            }
        }
    });
    
    return headResponse;
}

// Extract email from the sender string
// If there is only name then return name
function getemailFromSender(senderString)
{
    // Email matching expression
    var regex = /<?([^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)>?/;
    var match = regex.exec(senderString);
    
    // If the regular expression matches, extract sender's name and email address
    if (match && match.length === 2) {
        var senderEmail = match[1] || match[2];
        return senderEmail.trim();
    } else {
        // If no match is found then return it as it was
        return senderString;
    }
}

// Get full message body
function getBody(payload) {
    var parts = payload.parts;
    if (!parts) {
      return decodeURIComponent(escape(window.atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'))));
    }
    for (var i = 0; i < parts.length; i++) {
        if (parts[i].mimeType === 'text/html') {
            if (parts[i].body.data) {
                return decodeURIComponent(escape(window.atob(parts[i].body.data.replace(/-/g, '+').replace(/_/g, '/'))));
            }
        }
    }
    return '';
}

function loadSingleMessageBody(messageId)
{
    $("#conversation-messages-all > .full-message-container").html('<div id="loader"></div>');
    $("#conversation-full-message").show();
    $("#conversation-messages-all").hide();

    gapi.client.gmail.users.messages.get({
        'userId': 'me',
        'id': messageId
    }).then(function (response) {
        console.log(response.result);
        let htmlBody = getBody(response.result.payload);

        // Check if there are attachments
        if (response.result.payload.parts && response.result.payload.parts.length > 0) {
            response.result.payload.parts.forEach(function(part) {
                if (part.filename && part.body.attachmentId) {
                    // Assuming you have a function named 'downloadAttachment' to download attachments
                    let downloadLink = '<a href="#" onclick="downloadAttachment(\'' + messageId + '\', \'' + part.body.attachmentId  + '\', \'' + part.mimeType  + '\', \'' + part.filename + '\')">' + part.filename + '</a>';
                    htmlBody += '<p>Attachment: ' + downloadLink + '</p>';
                }
            });
        }

        shadowRoot.innerHTML = htmlBody;

    }, function (error) {
        // Handle error
        console.log('Error response:  ' + error);
        if (error.status == 401) {
            localStorage.removeItem("access_token");
            handleAuthClick();
            return;
        }
    });
}

function b64toBlob(b64Data, contentType, sliceSize) {
    contentType = contentType || ''
    sliceSize = sliceSize || 512
  
    var byteCharacters = atob(b64Data)
    var byteArrays = []
  
    for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      var slice = byteCharacters.slice(offset, offset + sliceSize)
  
      var byteNumbers = new Array(slice.length)
      for (var i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i)
      }
  
      var byteArray = new Uint8Array(byteNumbers)
  
      byteArrays.push(byteArray)
    }
  
    var blob = new Blob(byteArrays, {type: contentType})
    let urlBlob = URL.createObjectURL(blob)
    return urlBlob
  }
  
// Function to download attachment
function downloadAttachment(messageId, attachmentId, mimeType, fileName) {
    gapi.client.gmail.users.messages.attachments.get({
        'userId': 'me',
        'messageId': messageId,
        'id': attachmentId
    }).then(function(response) {
        let attachment = response.result;
        let dataBase64Rep = attachment.data.replace(/-/g, '+').replace(/_/g, '/')

       let urlBlob = b64toBlob(dataBase64Rep, mimeType, attachment.size)

       let dlnk = document.getElementById('download-attach')
       dlnk.href = urlBlob
       dlnk.download = fileName
       dlnk.click()
       URL.revokeObjectURL(urlBlob)
    }, function(error) {
        console.error('Error fetching attachment:', error);
    });
}

function closeSingleMessage()
{
    $("#conversation-full-message").hide();
    $("#conversation-messages-all").show();
}
  
//Load jQuery event after page load
function loadJqueryEvents()
{
    //Load more event conversation timeline
    $("#conversation-loadmore").click(function(){
        console.log("load more...", conversationNextPage);
        if (conversationNextPage && conversationFrom) {
            console.log("loading...");
            listUserEmails(conversationFrom, conversationNextPage);
        }
    });

    //Load more event for inbox timeline
    $(".inboxTimelineLoadmore").click(function(){
        console.log("load more...",currentFolder, inboxTimelineNextPage);
        if (inboxTimelineNextPage && currentFolder) {
            console.log("loading...");
            inboxTimeline(currentFolder, inboxTimelineNextPage);
        }
    });
// reply functionality 



    // Open full body message
    $(".read-full-message").click(function () {
        $("#conversation-messages-all").html('<div id="loader"></div>');
        
        let messageId = $(this).data("message-id");
        console.log(messageId);
        
        $("#conversation-full-message").show();
        $("#conversation-messages-all").hide();

        gapi.client.gmail.users.messages.get({
            'userId': 'me',
            'id': messageId
        }).then(function (response) {
            console.log(response.result);
            let htmlBody = getBody(response.result.payload);
            $("#conversation-full-message").html(htmlBody);
        }, function (error) {
            // Handle error
            console.log('Error response:  ' + error);
            if (error.status == 401) {
                localStorage.removeItem("access_token");
                handleAuthClick();
                return;
            }
        });
    });
    
}