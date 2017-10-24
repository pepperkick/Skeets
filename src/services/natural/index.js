import natural from 'natural';

const classifer = new natural.BayesClassifier();

classifer.addDocument('hi', 'greet');
classifer.addDocument('hello', 'greet');
classifer.addDocument('play', 'play');
classifer.train();

export default () => {
    return {
        classify: message => classifer.getClassifications(message),
    };
};