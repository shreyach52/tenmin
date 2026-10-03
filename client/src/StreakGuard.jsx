import { useState } from "react";

const PROBLEMS = {
    dsa: [
        { title: "Two Sum", slug: "two-sum" },
        { title: "Valid Parentheses", slug: "valid-parentheses" },
        { title: "Contains Duplicate", slug: "contains-duplicate" },
        { title: "Valid Anagram", slug: "valid-anagram" },
        { title: "Reverse Linked List", slug: "reverse-linked-list" },
        { title: "Merge Two Sorted Lists", slug: "merge-two-sorted-lists" },
        { title: "Linked List Cycle", slug: "linked-list-cycle" },
        { title: "Binary Search", slug: "binary-search" },
        { title: "Maximum Depth of Binary Tree", slug: "maximum-depth-of-binary-tree" },
        { title: "Invert Binary Tree", slug: "invert-binary-tree" },
        { title: "Best Time to Buy and Sell Stock", slug: "best-time-to-buy-and-sell-stock" },
        { title: "Min Stack", slug: "min-stack" },
    ],
    sql: [
        { title: "Combine Two Tables", slug: "combine-two-tables" },
        { title: "Second Highest Salary", slug: "second-highest-salary" },
        { title: "Duplicate Emails", slug: "duplicate-emails" },
        { title: "Customers Who Never Order", slug: "customers-who-never-order" },
        { title: "Employees Earning More Than Their Managers", slug: "employees-earning-more-than-their-managers" },
        { title: "Rising Temperature", slug: "rising-temperature" },
        { title: "Delete Duplicate Emails", slug: "delete-duplicate-emails" },
        { title: "Department Highest Salary", slug: "department-highest-salary" },
    ],
};

const KEY = "tenmin-streak";

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD

function shift(dateStr, days) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d + days);
    return dt.toLocaleDateString("en-CA");
}

function dayNumber(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

function computeStreak(done) {
    const set = new Set(done);
    let day = today();
    if (!set.has(day)) day = shift(day, -1); // streak is still alive until today ends
    let n = 0;
    while (set.has(day)) {
        n++;
        day = shift(day, -1);
    }
    return n;
}

function load() {
    try {
        return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch {
        return [];
    }
}

export default function StreakGuard() {
    const [done, setDone] = useState(load);
    const [topic, setTopic] = useState("dsa");

    const list = PROBLEMS[topic];
    const pick = list[dayNumber(today()) % list.length];
    const doneToday = done.includes(today());
    const streak = computeStreak(done);

    function save(next) {
        setDone(next);
        try {
            localStorage.setItem(KEY, JSON.stringify(next));
        } catch {
            /* storage unavailable: streak just won't persist */
        }
    }

    const markDone = () => save([...new Set([...done, today()])]);
    const undo = () => save(done.filter((d) => d !== today()));

    return (
        <section className="streak">
            <div className="streak-top">
                <strong>
                    {streak > 0 ? `${streak}-day streak` : "No streak yet"}
                </strong>
                <div className="tabs">
                    <button
                        className={topic === "dsa" ? "tab on" : "tab"}
                        onClick={() => setTopic("dsa")}
                    >
                        DSA
                    </button>
                    <button
                        className={topic === "sql" ? "tab on" : "tab"}
                        onClick={() => setTopic("sql")}
                    >
                        DBMS / SQL
                    </button>
                </div>
            </div>

            <p className="streak-line">
                Today's problem:{" "}
                <a
                    href={`https://leetcode.com/problems/${pick.slug}/`}
                    target="_blank"
                    rel="noreferrer"
                >
                    {pick.title}
                </a>
            </p>

            {doneToday ? (
                <p className="streak-line ok">
                    Done for today. Streak safe.{" "}
                    <button className="link" onClick={undo}>
                        undo
                    </button>
                </p>
            ) : (
                <>
                    <button onClick={markDone}>I solved one today</button>
                    <p className="hint">
                        Exam day? One easy problem on LeetCode or GFG is enough to keep it alive.
                    </p>
                </>
            )}
        </section>
    );
}