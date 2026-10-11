# HouseLearning Lessons Page

Welcome to **HouseLearning Lessons Page** — a fun and interactive learning website designed to make education engaging through browser-based mini-games and activities. The platform offers a collection of educational games that help users practice and reinforce their skills while having fun.
<br>
<a href="https://github.com/houselearning/docs/blob/main/roadmap/roadmap-2026.md">Curious to see our plans? Check the roadmap.</a>
## Features

- 🌟 **Interactive educational games**  
  Engaging activities that respond to player input in real time.

- 🏆 **Instant feedback and rewards**  
  Players get immediate results, points, and progress indicators to track learning.

- 📱 **Simple, clean, and responsive interface**  
  Designed to be easy to use on desktop and mobile browsers.

- 🎨 **Web-based — no installation required**  
  Runs directly in your web browser with no extra software needed.

## 🛠️ Tech Stack

- **HTML5**
- **CSS3**
- **JavaScript**
- **Firebase API**

## Email Notifications

`receivePushNotificationEmail` accepts SendGrid Inbound Parse multipart webhooks. Create the `PUSH_EMAIL_WEBHOOK_SECRET` Firebase Functions secret, then deploy with `firebase deploy --only firestore:rules` and `firebase deploy --only functions:receivePushNotificationEmail,functions:getNotificationImage`. Configure the SendGrid Parse URL as the deployed function URL with `?token=` followed by that secret. Keep the secret in Firebase Secret Manager and the mail-provider configuration; never put it in `firestore.rules` or frontend code. Route `push-notifications@houselearning.org` to SendGrid Inbound Parse through the domain's existing email provider; do not replace domain-wide MX records unless that is intentional.

Only messages whose parsed sender is `cajm23331@gmail.com` are accepted. Subjects must be exactly `@everyone`, `@admins-only`, `@students`, `@teachers`, or `@user user@example.com`. Accounts without an admin or teacher role are treated as students. Text is rendered as plain text; PNG, JPEG, GIF, and WebP attachments are accepted, while other attachments are rejected. Image files are served only after verifying the signed-in user's access to the notification.

## 📸 Screenshots

Here’s a preview of the HouseLearning Home website (*subject to change*):
![HouseLearning Home Screenshot](https://houselearning.github.io/home/readme/screenshot.png)

