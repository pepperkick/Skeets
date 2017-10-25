const reply = {
    'chat.greet': [
        'Hello there <name>!',
        'Hi <name>!',
    ],
};

export default () => {
    return {
        getReply: (action) => {
            const replies = reply[action];
            const index = new Date().getTime() % replies.length;

            return replies[index];
        },
        processReply: {
            name: (text, name) => text.replace('<name>', name)
        }
    };
};