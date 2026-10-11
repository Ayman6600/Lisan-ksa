-- 000003_seed_saudi_knowledge.sql
-- Seed initial verified Saudi workplace & digital services guidance and glossary

-- Seed Essential Glossary Terms
INSERT INTO glossary_terms (id, source_term, source_language, approved_translations, context, version, status)
VALUES
(
    '10000000-0000-0000-0000-000000000001',
    'إقامة',
    'ar',
    '[{"lang": "en", "term": "Residence Permit (Iqama)", "notes": "Official identity and residency document for foreign residents in Saudi Arabia"}, {"lang": "ur", "term": "اقامہ / رہائشی پرمٹ", "notes": "سعودی عرب میں رہائشی پروانہ"}, {"lang": "hi", "term": "इकामा / निवास परमिट", "notes": "सऊदी अरब में निवास पहचान पत्र"}, {"lang": "bn", "term": "ইকামা / রেসিডেন্স পারমিট", "notes": "সৌদি আরবে বসবাসের অনুমতিপত্র"}]'::jsonb,
    'Ministry of Interior / Absher / Jawazat residency identity document.',
    '1.0',
    'active'
),
(
    '10000000-0000-0000-0000-000000000002',
    'منصة قوى',
    'ar',
    '[{"lang": "en", "term": "Qiwa Platform", "notes": "Ministry of Human Resources platform for employment contracts and work permits"}, {"lang": "ur", "term": "قویٰ پلیٹ فارم", "notes": "وزارت افرادی قوت کا لیبر پلیٹ فارم"}, {"lang": "hi", "term": "किवा प्लेटफॉर्म", "notes": "श्रम एवं रोजगार अनुबंध मंच"}, {"lang": "bn", "term": "কিওয়া প্ল্যাটফর্ম", "notes": "চাকরির চুক্তি ও লেবার প্ল্যাটফর্ম"}]'::jsonb,
    'Ministry of Human Resources and Social Development (MHRSD) digital labor portal.',
    '1.0',
    'active'
),
(
    '10000000-0000-0000-0000-000000000003',
    'تأشيرة خروج وعودة',
    'ar',
    '[{"lang": "en", "term": "Exit and Re-entry Visa", "notes": "Permit allowing a resident to leave the Kingdom temporarily and return"}, {"lang": "ur", "term": "خروج و عودہ ویزا", "notes": "عارضی طور پر جانے اور واپس آنے کا ویزا"}, {"lang": "hi", "term": "एग्जिट और री-एंट्री वीजा", "notes": "वापसी यात्रा परमिट"}, {"lang": "bn", "term": "এক্সিট এবং রি-এন্ট্রি ভিসা", "notes": "সাময়িক প্রস্থান ও পুনঃপ্রবেশ ভিসা"}]'::jsonb,
    'Issued via Absher/Muqeem for travel outside KSA.',
    '1.0',
    'active'
),
(
    '10000000-0000-0000-0000-000000000004',
    'التأمينات الاجتماعية',
    'ar',
    '[{"lang": "en", "term": "General Organization for Social Insurance (GOSI)", "notes": "Saudi social insurance and workplace hazard scheme"}, {"lang": "ur", "term": "گوسی / سماجی انشورنس", "notes": "سعودی سوشل انشورنس"}, {"lang": "hi", "term": "गोसी / सामाजिक बीमा", "notes": "सऊदी सामाजिक सुरक्षा संस्थान"}, {"lang": "bn", "term": "গোসি / সামাজিক বীমা", "notes": "সৌদি সামাজিক নিরাপত্তা সংস্থা"}]'::jsonb,
    'Social insurance coverage and injury compensation.',
    '1.0',
    'active'
),
(
    '10000000-0000-0000-0000-000000000005',
    'مكافأة نهاية الخدمة',
    'ar',
    '[{"lang": "en", "term": "End of Service Award (Gratuity)", "notes": "Statutory severance calculated under Saudi Labor Law Article 84"}, {"lang": "ur", "term": "سروس کا اختتامی معاوضہ", "notes": "سعودی لیبر لاء کے تحت گریجویٹی"}, {"lang": "hi", "term": "सेवा समाप्ति ग्रेच्युटी", "notes": "सऊदी श्रम कानून के अनुसार विदाई वेतन"}, {"lang": "bn", "term": "এন্ড অফ সার্ভিস বোনাস / গ্র্যাচুইটি", "notes": "সৌদি শ্রম আইন অনুযায়ী সেবামূল্য"}]'::jsonb,
    'Saudi Labor Law statutory end of service compensation.',
    '1.0',
    'active'
)
ON CONFLICT (id) DO NOTHING;

-- Seed Knowledge Documents
INSERT INTO knowledge_documents (id, title, language, source_reference, owner, version, status)
VALUES
(
    '20000000-0000-0000-0000-000000000001',
    'Saudi Labor Law - End of Service Award Calculation (Article 84)',
    'en',
    'Saudi Labor Law Royal Decree No. M/51, Article 84',
    'MHRSD Guidance',
    '1.0',
    'published'
),
(
    '20000000-0000-0000-0000-000000000002',
    'Qiwa Digital Employment Contract Verification & Transfer',
    'en',
    'Qiwa Official Portal https://qiwa.sa',
    'Ministry of Human Resources',
    '1.0',
    'published'
),
(
    '20000000-0000-0000-0000-000000000003',
    'Absher & Muqeem Exit-Reentry Visa Procedures',
    'en',
    'Absher Platform / General Directorate of Passports (Jawazat)',
    'Ministry of Interior',
    '1.0',
    'published'
)
ON CONFLICT (id) DO NOTHING;

-- Seed Knowledge Chunks for Full-Text Search
INSERT INTO knowledge_chunks (id, document_id, chunk_text, section_reference, metadata)
VALUES
(
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'Under Saudi Labor Law Article 84, upon contract end, an employee is entitled to an End of Service Award calculated as half a month wage for each of the first five years, and one month wage for each subsequent year, based on the last wage paid.',
    'Article 84',
    '{"category": "labor_law", "topic": "end_of_service"}'::jsonb
),
(
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'All private sector employment contracts in Saudi Arabia must be digitally documented and authenticated through the Qiwa platform. Employees can review their contract clauses, salary breakdown, working hours, and notice periods by logging into their Qiwa account using Nafath authentication.',
    'Contract Authentication',
    '{"category": "contracts", "portal": "qiwa"}'::jsonb
),
(
    '30000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000003',
    'An exit and re-entry visa requires a valid Iqama (residence permit) covering the duration of travel, a valid passport for at least 90 days, payment of government visa fees via Sadad, and absence of outstanding traffic violations on Absher.',
    'Visa Requirements',
    '{"category": "passports", "portal": "absher"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;
