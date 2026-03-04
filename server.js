require('dotenv').config();
const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize SQLite database
const db = new Database(path.join(__dirname, 'demo_assessments.db'));

// Create tables
db.exec(`
    CREATE TABLE IF NOT EXISTS assessments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        applicant_name TEXT NOT NULL,
        demo_date TEXT,
        assessor_name TEXT,
        topic TEXT,
        level_targeted TEXT,
        assessment_score TEXT,
        criteria JSON,
        additional_comments TEXT,
        final_result TEXT,
        met_total INTEGER,
        ni_total INTEGER,
        fail_total INTEGER,
        ai_feedback TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Get all assessments
app.get('/api/assessments', (req, res) => {
    const search = req.query.search || '';
    let stmt;
    if (search) {
        stmt = db.prepare(`
            SELECT * FROM assessments
            WHERE applicant_name LIKE ? OR topic LIKE ? OR assessor_name LIKE ?
            ORDER BY created_at DESC
        `);
        const assessments = stmt.all(`%${search}%`, `%${search}%`, `%${search}%`);
        res.json(assessments);
    } else {
        stmt = db.prepare('SELECT * FROM assessments ORDER BY created_at DESC');
        res.json(stmt.all());
    }
});

// API: Get single assessment
app.get('/api/assessments/:id', (req, res) => {
    const stmt = db.prepare('SELECT * FROM assessments WHERE id = ?');
    const assessment = stmt.get(req.params.id);
    if (assessment) {
        res.json(assessment);
    } else {
        res.status(404).json({ error: 'Assessment not found' });
    }
});

// API: Create assessment
app.post('/api/assessments', (req, res) => {
    const {
        applicant_name, demo_date, assessor_name, topic, level_targeted,
        assessment_score, criteria, additional_comments, final_result,
        met_total, ni_total, fail_total, ai_feedback
    } = req.body;

    const stmt = db.prepare(`
        INSERT INTO assessments (
            applicant_name, demo_date, assessor_name, topic, level_targeted,
            assessment_score, criteria, additional_comments, final_result,
            met_total, ni_total, fail_total, ai_feedback
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
        applicant_name, demo_date, assessor_name, topic, level_targeted,
        assessment_score, JSON.stringify(criteria), additional_comments, final_result,
        met_total, ni_total, fail_total, ai_feedback
    );

    res.json({ id: result.lastInsertRowid, message: 'Assessment saved' });
});

// API: Update assessment
app.put('/api/assessments/:id', (req, res) => {
    const {
        applicant_name, demo_date, assessor_name, topic, level_targeted,
        assessment_score, criteria, additional_comments, final_result,
        met_total, ni_total, fail_total, ai_feedback
    } = req.body;

    const stmt = db.prepare(`
        UPDATE assessments SET
            applicant_name = ?, demo_date = ?, assessor_name = ?, topic = ?,
            level_targeted = ?, assessment_score = ?, criteria = ?,
            additional_comments = ?, final_result = ?, met_total = ?,
            ni_total = ?, fail_total = ?, ai_feedback = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);

    stmt.run(
        applicant_name, demo_date, assessor_name, topic, level_targeted,
        assessment_score, JSON.stringify(criteria), additional_comments, final_result,
        met_total, ni_total, fail_total, ai_feedback, req.params.id
    );

    res.json({ message: 'Assessment updated' });
});

// API: Delete assessment
app.delete('/api/assessments/:id', (req, res) => {
    const stmt = db.prepare('DELETE FROM assessments WHERE id = ?');
    stmt.run(req.params.id);
    res.json({ message: 'Assessment deleted' });
});

// API: Send to Notion
app.post('/api/send-to-notion', async (req, res) => {
    const {
        applicantName, demoDate, assessorName, topic, levelTargeted,
        assessmentScore, criteriaDetails, additionalComments,
        metTotal, niTotal, failTotal, finalAssessment, aiFeedback
    } = req.body;

    const notionApiKey = process.env.NOTION_API_KEY;
    const databaseId = process.env.NOTION_DATABASE_ID;

    if (!notionApiKey || !databaseId) {
        return res.status(500).json({
            error: 'Notion API key or database ID not configured.'
        });
    }

    try {
        // Build properties matching the exact Notion database schema
        const properties = {
            'Applicant Name': {
                title: [{ text: { content: applicantName || '' } }]
            },
            'Assessor': {
                rich_text: [{ text: { content: assessorName || '' } }]
            },
            'Topic': {
                rich_text: [{ text: { content: topic || '' } }]
            },
            'Score': {
                rich_text: [{ text: { content: assessmentScore || '' } }]
            },
            'Met': {
                number: metTotal || 0
            },
            'NI': {
                number: niTotal || 0
            },
            'Fail': {
                number: failTotal || 0
            },
            'AI Feedback': {
                rich_text: [{ text: { content: (aiFeedback || '').substring(0, 2000) } }]
            }
        };

        // Add date if provided
        if (demoDate) {
            properties['Demo Date'] = {
                date: { start: demoDate }
            };
        }

        // Add Level as select if provided
        if (levelTargeted) {
            properties['Level'] = {
                select: { name: levelTargeted }
            };
        }

        // Add Final Result as select if provided
        if (finalAssessment) {
            properties['Final Result'] = {
                select: { name: finalAssessment }
            };
        }

        // Create the page with all properties and criteria details in content
        const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${notionApiKey}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                parent: { database_id: databaseId },
                properties: properties,
                children: [
                    {
                        object: 'block',
                        type: 'heading_2',
                        heading_2: {
                            rich_text: [{ text: { content: 'Criteria Details' } }]
                        }
                    },
                    {
                        object: 'block',
                        type: 'paragraph',
                        paragraph: {
                            rich_text: [{ text: { content: criteriaDetails || 'No details provided' } }]
                        }
                    },
                    {
                        object: 'block',
                        type: 'divider',
                        divider: {}
                    },
                    {
                        object: 'block',
                        type: 'heading_2',
                        heading_2: {
                            rich_text: [{ text: { content: 'Additional Comments' } }]
                        }
                    },
                    {
                        object: 'block',
                        type: 'paragraph',
                        paragraph: {
                            rich_text: [{ text: { content: additionalComments || 'None' } }]
                        }
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || response.statusText);
        }

        const result = await response.json();
        res.json({ success: true, pageId: result.id, url: result.url });
    } catch (error) {
        console.error('Notion API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: Generate AI feedback
app.post('/api/generate-feedback', async (req, res) => {
    const {
        applicantName, topic, levelTargeted, assessmentScore,
        criteriaDetails, additionalComments, metTotal, niTotal,
        failTotal, finalAssessment
    } = req.body;

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({
            error: 'OpenAI API key not configured.'
        });
    }

    const messages = [
        {
            role: "system",
            content: "You are an evaluator at ICAN Language Center. Generate a BRIEF verbal feedback script that the assessor will READ ALOUD to the applicant right after their teaching demo. Keep it conversational, warm but professional. Use simple sentences. This is a speaking guide, not a written report."
        },
        {
            role: "user",
            content: `
Create a brief verbal feedback script for me to tell this applicant after their teaching demo:

Applicant: ${applicantName}
Topic: ${topic}
Level: ${levelTargeted}
Score: ${assessmentScore}
Result: ${finalAssessment}

Summary: Met: ${metTotal} | Needs Improvement: ${niTotal} | Failed: ${failTotal}

DETAILED CRITERIA BREAKDOWN:
${criteriaDetails}

${additionalComments ? `Additional Comments from Assessor: ${additionalComments}` : ''}

Based on the detailed criteria above, generate a SHORT speaking script (under 200 words) with:
1. Brief greeting and thank you (1 sentence)
2. What they did well - reference specific criteria that were MET (2-3 bullet points)
3. What to improve - reference specific criteria that NEED IMPROVEMENT or FAILED (2-3 bullet points)
4. Final decision announcement (${finalAssessment})
5. Brief closing (1 sentence)

Keep it natural and conversational - this will be spoken aloud, not read as a document. Use the assessor's notes where provided.
            `
        }
    ];

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: messages,
                max_tokens: 500,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || response.statusText);
        }

        const result = await response.json();
        res.json({ feedback: result.choices[0].message.content.trim() });
    } catch (error) {
        console.error('OpenAI API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at:`);
    console.log(`  - Local:   http://localhost:${PORT}`);
    console.log(`  - Network: http://0.0.0.0:${PORT}`);
});
