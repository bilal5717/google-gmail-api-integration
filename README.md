### All Steps 
http://localhost:8024/PhpClasses/google-gmail-api-integration/

1. Enable Google Gmail API:
    a. Go to the Google Cloud Console.
    b. Create a new project or select an existing one.
    c. Enable the Gmail API for your project.
    d. Create credentials (OAuth client ID) for your project to authenticate requests.
2. Complete consent screen
3. Enable APIs
    People API
    Gmail API


### Some Google Documetation URLs
```
https://developers.google.com/gmail/api/quickstart/js

https://developers.google.com/gmail/api/reference/rest/v1/users.messages/list

https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow

```

### Get Token INFO
```
https://www.googleapis.com/oauth2/v1/tokeninfo?access_token={token}

// SOme API call

https://gmail.googleapis.com/gmail/v1/users/me/messages?access_token={access_token}
```