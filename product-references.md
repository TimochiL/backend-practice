# Product References - HackerRank Backend Coding Assessments (Node.js, Django, Spring Boot)

HackerRank's own docs cover structure, tooling, and scoring well. Candidate-side reports are thinner, and there are no hard numbers on total test duration.

## File Objective

List sources that describe and inspire the purpose, appearance, and details of the final product
 
## What HackerRank documents officially
 
**Format.** Back-end questions are project-based. You get a back-end project plus an IDE to run and test your code. The codebase is multi-file, organized into directories, rather than a single-file problem. The IDE has file navigation, terminal access, and execution support.
 
**Repo mechanics** (from the question-setter docs, which show what you'll see as a candidate):
 
- Projects load from a ZIP (5MB max) or a GitHub clone, with Install, Run, and Test commands configured. The IDE starts installing automatically when the question loads, and you click Run to start the app.
- Setters can mark read-only files, such as test cases or READMEs. If the project has read-only or hidden files, you'll see a `PROJECT_FILES_INSTRUCTIONS.md`. Editing a read-only file (even from the terminal) results in a zero score.
- Hidden test files are never downloaded into your IDE, and "Run test" doesn't show whether they pass. They're added at scoring time, so don't create files with the same names.
**Scoring.**
 
- The default is JUnit-style scoring, with equal points per test case. Passing 3 of 5 tests on a 50-point question gives 30.
- TAP output and custom scoring scripts are also supported, and manual scoring is possible.
**Time guidance.**
 
| Difficulty | Score | Recommended time |
| ---------- | ----- | ---------------- |
| Easy | 50 | 15 min |
| Medium | 75 | 30 min |
| Hard | 100 | 45-60 min |
 
Overall test length is set by the hiring company. HackerRank's own design article suggests 60-90 minutes for junior backend challenges, with about 15-20 minutes reading the codebase. That same article's FAQ says 2-4 hours, so the guidance isn't consistent. Check your invitation.
 
**Environments** (from the execution-environment page; a specific company can pin different versions):
 
| Stack | Environment |
| ----- | ----------- |
| Node.js | Node v24.15.0, npm 11.15.0, yarn 1.22.22 |
| Django | Python 3.13 with pip |
| Spring Boot | Java 25, Maven 3.9.16, Tomcat 11.0.22, MySQL 8.4 |
 
The IDE warns you if the project touches blacklisted domains.
 
## Problem types
 
- HackerRank's backend design guide lists REST endpoints with correct status codes, auth middleware, input validation and error handling, filtering/sorting, schema migrations, and CI/pipeline debugging. It's written for question setters, so treat it as a model of the genre rather than a leak of real questions.
- Its sample Node starter repo has `src/models`, `src/routes`, `app.js`, `migrations/`, `tests/`, and `package.json`.
- HackerRank's ASTRA benchmark paper includes an example of a Node.js/Express RESTful API for managing product records, mirroring e-commerce work. It also lists Django and Spring Boot among its frameworks.
- A Better Engineers post covers a Spring Boot problem: a REST API for trading stocks using Spring Boot and JPA. It's paywalled past the problem statement.
- HackerRank also has a job post for people who build repo tasks like debugging APIs, optimizing queries, and designing microservices.
## Candidate-reported experience
 
PracHub's IBM Software Developer Intern 2027 guide is the most relevant recent source. It reports one standalone coding problem plus a repository task where candidates added validation to a web app. Django, Node.js, or Spring Boot variants were offered in one report, while another backend applicant saw only Django. It also gives a practical framework for the task:
 
- Read the requirements, reproduce the failure, and trace the request path.
- Make a minimal patch.
- Run targeted tests, then the full suite.
- Cover missing and blank fields, boundaries, duplicates, and error status codes, since hidden tests will probe them.
PracHub cites three Reddit threads in r/csMajors (IBM OA changes, the IBM competency OA, an IBM backend OA). They weren't opened directly, so those details are secondhand.
 
## Caveats
 
- Per-company details (total time, framework choice, AI/tool policy, proctoring) are set by the employer, so your invitation is the real authority.
- Some of the third-party sites (PracHub, tooliverse, womentech.net) are SEO-flavored. Trust the HackerRank support docs first and use the rest as color.
- Several developer GitHub repos showed up in the results but contained nothing about assessment structure.
## Sources
 
- [HackerRank: Front-end, Back-end, Full-stack, Mobile, and QA Engineer Questions](https://support.hackerrank.com/articles/1570281449-creating-front-end%2C-back-end-full-stack-and-mobile-questions)
- [HackerRank: Hidden Test Cases for Front-End, Back-End and Full Stack Questions](https://support.hackerrank.com/articles/1626384486-hidden-test-cases-for-front-end%2C-back-end-and-full-stack-questions)
- [HackerRank: Execution Environment](https://support.hackerrank.com/articles/6693750503-execution-environment)
- [HackerRank: Question Types in HackerRank Interviews](https://support.hackerrank.com/articles/9999244916-question-types-in-hackerrank-interviews)
- [HackerRank: Introduction to HackerRank Projects](https://hackerrank-knowledge-base.help.usepylon.com/articles/8401114407-introduction-to-hackerrank-projects)
- [HackerRank: Designing Real-World Coding Challenges for Junior Backend Screening](https://www.hackerrank.com/writing/design-real-world-coding-challenges-junior-backend-developer-screening-2025)
- [HackerRank-ASTRA benchmark (arXiv)](https://arxiv.org/html/2502.00226v1)
- [PracHub: IBM Software Developer Intern OA 2027](https://prachub.com/resources/ibm-software-developer-intern-oa-2027-repository-debugging-django-node-spring-boot-and-hidden-tests)
- [Better Engineers: HackerRank Spring Boot Test, Trades API](https://betterengineers.substack.com/p/hackerrank-springboot-test-trades-api-540be3063f28)