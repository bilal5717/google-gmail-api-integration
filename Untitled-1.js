
 /* function getSenderProfileImage(email, timelineEntry) {
    // Check if the sender's email address exists in the cache
    if (senderImages[email]) {
        console.log("Sender image cached:", senderImages[email]);
        timelineEntry.find('.profile-picture').attr('src', senderImages[email]);
        return;
    }

    // Define parameters for exponential backoff
    const MAX_RETRIES = 5;
    const INITIAL_DELAY_MS = 1000; // 1 second
    let delay = INITIAL_DELAY_MS;
    let retries = 0;

    // Define function to fetch profile image with retries
    const fetchProfileImageWithRetry = () => {
        gapi.client.people.people.searchContacts({
            'query': email,
            'readMask': 'photos'
        }).then(function(response) {
            const connections = response.result.results;
            if (connections && connections.length > 0 && connections[0].person.photos && connections[0].person.photos.length > 0) {
                var profileImageUrl = connections[0].person.photos[0].url;
                // Update the profile picture in the timeline entry
                timelineEntry.find('.profile-picture').attr('src', profileImageUrl);
                senderImages[email] = profileImageUrl;
            } else {
                console.log('No profile image found for email:', email);
            }
        }).catch(function(error) {
            console.error('Error fetching profile photo:', error);
            if (retries < MAX_RETRIES) {
                // Retry with exponential backoff
                retries++;
                setTimeout(fetchProfileImageWithRetry, delay);
                delay *= 2; // Exponential backoff
            } else {
                console.error('Max retries exceeded. Unable to fetch profile photo.');
            }
        });
    };

    // Start fetching profile image with retries
    fetchProfileImageWithRetry();
}
 */