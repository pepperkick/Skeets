const reply = {
    'chat.greet': [
        'Hello there!',
        'Hi!',
    ],
};

export default (action) => {
    const replies = reply[action];
    const index = new Date().getTime() % replies.length;

    return replies[index];
};