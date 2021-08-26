const uploadHelper = require('../helpers/uploadHelper');
const db = require('../models');
const crowdGoals = db.CrowdGoals;
const crowdsIntersts = db.CrowdsIntersts;
const S3BUCKETURL = uploadHelper.S3BUCKETURL;
const CROWD_GOAL_PATH = S3BUCKETURL + uploadHelper.CROWD_GOAL_PATH;
const CROWD_TOPIC_PATH = S3BUCKETURL + uploadHelper.CROWD_TOPIC_PATH;

function getGoalId(number) {
    return 'goal_' + number;
}

function getGoalImagePath(iName) {
    return CROWD_GOAL_PATH + iName;
}

function getInterestId(number) {
    return 'interest_' + number;
}

function getInterestImagePath(iName) {
    return CROWD_TOPIC_PATH + iName;
}

async function crowdGoalsSeeder() {
    let count = await crowdGoals.countDocuments();
    console.log('count...', count);
    if (!count) {
        await crowdGoals.create([
            {
                '_id': getGoalId(1),
                'goalsName': 'Solve a specific problem',
                'image': getGoalImagePath('Solve-a-specific-problem.png'),
            }, {
                '_id': getGoalId(2),
                'goalsName': 'Improve work life balance',
                'image': getGoalImagePath('Improve-work-life-balance.png'),
            }, {
                '_id': getGoalId(3),
                'goalsName': 'Become more creative',
                'image': getGoalImagePath('Become-more-creative.png'),
            }, {
                '_id': getGoalId(4),
                'goalsName': 'Become more adaptable',
                'image': getGoalImagePath('Become-more-adaptable.png'),
            }, {
                '_id': getGoalId(5),
                'goalsName': 'Build resilience',
                'image': getGoalImagePath('Build-resilience.png'),
            }, {
                '_id': getGoalId(6),
                'goalsName': 'Become a coach',
                'image': getGoalImagePath('Become-a-coach.png'),
            }, {
                '_id': getGoalId(7),
                'goalsName': 'Find a coach',
                'image': getGoalImagePath('Find-a-coach.png'),
            }, {
                '_id': getGoalId(8),
                'goalsName': 'Build a second income',
                'image': getGoalImagePath('Build-a-second-income.png'),
            }, {
                '_id': getGoalId(9),
                'goalsName': 'Progress in my career',
                'image': getGoalImagePath('Progress-my-career.png'),
            }, {
                '_id': getGoalId(10),
                'goalsName': 'Become financially secure',
                'image': getGoalImagePath('Become-financially-secure.png'),
            }
        ]);
    }
}

async function crowdTopicsSeeder() {
    let count = await crowdsIntersts.countDocuments();
    if (!count) {
        await crowdsIntersts.create([{
            '_id': getInterestId(1),
            'interestName': 'PR and Media',
            'image': getInterestImagePath('PR-and-Media.png'),
        }, {
            '_id': getInterestId(2),
            'interestName': 'Report writing',
            'image': getInterestImagePath('Report-writing.png'),
        }, {
            '_id': getInterestId(3),
            'interestName': 'Marketing',
            'image': getInterestImagePath('Marketing.png'),
        }, {
            '_id': getInterestId(4),
            "createdAt": "2021-03-05T12:52:22.830Z",
            'interestName': 'Management',
            'image': getInterestImagePath('Management.png'),
        }, {
            '_id': getInterestId(5),
            'interestName': 'Social media',
            'image': getInterestImagePath('Social-media.png'),
        }, {
            '_id': getInterestId(6),
            'interestName': 'Business',
            'image': getInterestImagePath('Business.png'),
        }, {
            '_id': getInterestId(7),
            'interestName': 'Consulting',
            'image': getInterestImagePath('Consulting.png'),
        }, {
            '_id': getInterestId(8),
            'interestName': 'Economics',
            'image': getInterestImagePath('Economics.png'),
        }, {
            '_id': getInterestId(9),
            'interestName': 'Finance',
            'image': getInterestImagePath('Finance.png'),
        }, {
            '_id': getInterestId(10),
            'interestName': 'Design',
            'image': getInterestImagePath('Design.png'),
        }, {
            '_id': getInterestId(11),
            'interestName': 'Leadership',
            'image': getInterestImagePath('Leadership.png'),
        }, {
            '_id': getInterestId(12),
            'interestName': 'Communication',
            'image': getInterestImagePath('Communication.png'),
        }, {
            '_id': getInterestId(13),
            'interestName': 'Presentation skills',
            'image': getInterestImagePath('Presentation-skills.png'),
        }, {
            '_id': getInterestId(14),
            'interestName': 'Facilitation',
            'image': getInterestImagePath('Facilitation.png'),
        }, {
            '_id': getInterestId(15),
            'interestName': 'Side hustles',
            'image': getInterestImagePath('Side-hustles.png'),
        }, {
            '_id': getInterestId(16),
            'interestName': 'Health and Wellbeing',
            'image': getInterestImagePath('Health-and-Wellbeing.png'),
        }, {
            '_id': getInterestId(17),
            'interestName': 'Career planning',
            'image': getInterestImagePath('Career-planning.png'),
        }, {
            '_id': getInterestId(18),
            'interestName': 'Sales',
            'image': getInterestImagePath('Sales.png'),
        }, {
            '_id': getInterestId(19),
            'interestName': 'Data analysis',
            'image': getInterestImagePath('Data-analysis.png'),
        }, {
            '_id': getInterestId(20),
            'interestName': 'Happiness',
            'image': getInterestImagePath('Happiness.png'),
        }, {
            '_id': getInterestId(21),
            'interestName': 'Job security',
            'image': getInterestImagePath('Job-Security.png'),
        }, {
            '_id': getInterestId(22),
            'interestName': 'Confidence and motivation',
            'image': getInterestImagePath('Confidence-and-motivation.png'),
        }, {
            '_id': getInterestId(23),
            "createdAt": "2021-03-08T04:32:42.070Z",
            'interestName': 'Coding',
            'image': getInterestImagePath('Coding.png'),
        }, {
            '_id': getInterestId(24),
            "createdAt": "2021-03-08T04:33:21.693Z",
            'interestName': 'Strategy',
            'image': getInterestImagePath('Strategy.png'),
        }, {
            '_id': getInterestId(25),
            'interestName': 'Just for fun',
            'image': getInterestImagePath('Just-for-fun.png'),
        }, {
            '_id': getInterestId(26),
            'interestName': 'Networking',
            'image': getInterestImagePath('Networking.png'),
        }, {
            '_id': getInterestId(27),
            'interestName': 'Investing',
            'image': getInterestImagePath('Investing.png'),
        }, {
            '_id': getInterestId(28),
            'interestName': 'Problem solving',
            'image': getInterestImagePath('Problem-solving.png'),
        }, {
            '_id': getInterestId(29),
            'interestName': 'Public speaking',
            'image': getInterestImagePath('Public-speaking.png'),
        }]);
    }
}

module.exports = () => {
    crowdGoalsSeeder();
    crowdTopicsSeeder();
}