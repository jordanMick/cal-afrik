self.addEventListener('push', function(event) {
    const data = event.data ? event.data.json() : { title: 'Cal-Afrik', body: 'Il est temps de checker vos objectifs !' };
    
    const options = {
        body: data.body,
        icon: '/icons/icon-192x192.png', // Assurez-vous d'avoir une icône à cet endroit
        badge: '/icons/icon-192x192.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
