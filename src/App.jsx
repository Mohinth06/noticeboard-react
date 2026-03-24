import React, { useState, useEffect, useContext, useMemo, useRef, useReducer, createContext } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import './App.css';

// API base URL — reads from .env (VITE_API_URL) in dev,
// overridden to deployed Render URL in Vercel production settings
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ============================================
// EJS Demo Page — fetches /api/dynamic from Express
// Mirrors what EJS renders server-side, shown in React
// ============================================
const EjsDemoPage = () => {
    const [ejsData, setEjsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetch(`${API_BASE}/api/dynamic`)
            .then(res => res.json())
            .then(data => {
                setEjsData(data);
                setLoading(false);
            })
            .catch(err => {
                setError('Failed to fetch EJS data from server.');
                setLoading(false);
            });
    }, []);

    if (loading) return <div className="ejs-card"><p>Loading EJS data from Express...</p></div>;
    if (error)   return <div className="ejs-card"><p style={{color:'red'}}>{error}</p></div>;

    return (
        <div className="ejs-card">
            <div className="ejs-badge">⚙️ EJS Template Data — Rendered via React</div>
            <h2 className="ejs-title">{ejsData.title} — EJS Template</h2>
            <p className="ejs-desc">This page is dynamically rendered by Express and EJS.</p>
            <p className="ejs-desc">{ejsData.description}</p>
            <div className="ejs-time-box">
                🕐 Server Time: <strong>{ejsData.serverTime}</strong>
            </div>
            <div className="ejs-links">
                <a href={`${API_BASE}/dynamic`} target="_blank" rel="noreferrer">View Raw EJS Page ↗</a>
                <a href={API_BASE}               target="_blank" rel="noreferrer">Vanilla JS Board ↗</a>
                <a href="http://localhost:4200"         target="_blank" rel="noreferrer">Angular App ↗</a>
            </div>
        </div>
    );
};

// 1. Context API (useContext)
const ThemeContext = createContext({ theme: 'light' });

// 2. Custom Hook (useFetch)
function useFetch(url) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Points to our Node.js backend
        fetch(`${API_BASE}${url}`)
            .then(res => res.json())
            .then(json => {
                setData(json);
                setLoading(false);
            })
            .catch(e => {
                console.error("Error fetching", e);
                setLoading(false);
            });
    }, [url]);

    return { data, loading, setData };
}

// 3. Child Component (Props, Event Handling)
const NoticeCard = ({ notice, onDelete }) => {
    return (
        <div className="card notice-card-react">
            <span className="badge">{notice.type}</span>
            <h3>{notice.title}</h3>
            <p>{notice.content}</p>
            <small><i>{notice.author} - {new Date(notice.date).toLocaleDateString()}</i></small>
            <button className="del-btn" onClick={() => onDelete(notice.id)}>Delete</button>
        </div>
    );
};

// ============================================
// useReducer — Notice Filter State Manager
// WHY: When multiple related state values change
//      together, useReducer is cleaner than many useState.
// HOW: reducer(state, action) receives current state
//      and an action object, returns the next state.
//      dispatch(action) triggers the reducer.
// ============================================
const filterInitialState = {
    searchTerm: "",
    sortDesc:   true,
    filterType: "All"   // All | General | Urgent | Event
};

function filterReducer(state, action) {
    switch (action.type) {
        case "SET_SEARCH":
            return { ...state, searchTerm: action.payload };
        case "TOGGLE_SORT":
            return { ...state, sortDesc: !state.sortDesc };
        case "SET_TYPE_FILTER":
            return { ...state, filterType: action.payload };
        case "RESET":
            return filterInitialState;            // reset all filters at once
        default:
            return state;
    }
}

// 4. Main Page Component (useReducer, Conditional rendering, map, sort, filter)
const HomePage = ({ notices, setNotices, loading }) => {
    // useReducer replaces multiple useState calls for related state
    const [filterState, dispatch] = useReducer(filterReducer, filterInitialState);

    // Filter, type-filter & Sort (useMemo) MUST be before any early returns!
    const filteredAndSortedNotices = useMemo(() => {
        if (!notices || !Array.isArray(notices)) return [];

        let filtered = notices
            .filter(n => n.title.toLowerCase().includes(filterState.searchTerm.toLowerCase()))
            .filter(n => filterState.filterType === "All" || n.type === filterState.filterType);

        return filtered.sort((a, b) =>
            filterState.sortDesc
                ? new Date(b.date) - new Date(a.date)
                : new Date(a.date) - new Date(b.date)
        );
    }, [notices, filterState]);

    // Conditional Rendering safely after all hooks
    if (loading) return <p>Loading notices via React Custom Hook...</p>;

    const handleDelete = (id) => {
        setNotices(prev => prev.filter(n => n.id !== id));
    };

    return (
        <div>
            <h2>Announcements Dashboard</h2>

            {/* useReducer: dispatch actions to update filter state */}
            <div className="filters">
                <input
                    type="text"
                    placeholder="Search notices..."
                    value={filterState.searchTerm}
                    onChange={(e) => dispatch({ type: "SET_SEARCH", payload: e.target.value })}
                />
                <button onClick={() => dispatch({ type: "TOGGLE_SORT" })}>
                    Sort: {filterState.sortDesc ? "Newest First ↓" : "Oldest First ↑"}
                </button>
                <select
                    value={filterState.filterType}
                    onChange={(e) => dispatch({ type: "SET_TYPE_FILTER", payload: e.target.value })}
                >
                    <option value="All">All Types</option>
                    <option value="General">General</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Event">Event</option>
                </select>
                <button className="reset-btn" onClick={() => dispatch({ type: "RESET" })}>
                    Reset Filters
                </button>
            </div>

            {filteredAndSortedNotices.length === 0 ? (
                <p>No notices found.</p>
            ) : (
                // Map
                <div className="notice-grid">
                    {filteredAndSortedNotices.map(notice => (
                        <NoticeCard key={notice.id} notice={notice} onDelete={handleDelete} />
                    ))}
                </div>
            )}
        </div>
    );
};

// 5. Add Notice Page Component (useRef, Event handling)
const AddNoticePage = ({ onAdd }) => {
    const titleRef = useRef(); // useRef Hook
    const contentRef = useRef();
    const authorRef = useRef();
    const typeRef = useRef();
    const navigate = useNavigate();   

    const handleSubmit = (e) => {
        e.preventDefault(); // Event Handling
        const newNotice = {
            title: titleRef.current.value,
            content: contentRef.current.value,
            author: authorRef.current.value,
            type: typeRef.current.value
        };

        // POST to Express Server
        fetch(`${API_BASE}/api/notices`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newNotice)
        })
        .then(res => res.json())
        .then(data => {
            onAdd(data);
            navigate("/"); // React Router Redirect
        });
    };

    return (
        <div className="card form-card">
            <h2>Add New Notice</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Title</label>
                    <input ref={titleRef} required />
                </div>
                <div className="form-group">
                    <label>Content</label>
                    <textarea ref={contentRef} rows="4" required></textarea>
                </div>
                <div className="form-group">
                    <label>Author</label>
                    <input ref={authorRef} required />
                </div>
                <div className="form-group">
                    <label>Type</label>
                    <select ref={typeRef} required>
                        <option value="General">General</option>
                        <option value="Urgent">Urgent</option>
                        <option value="Event">Event</option>
                    </select>
                </div>
                <button type="submit" className="submit-btn">Submit Notice</button>
            </form>
        </div>
    );
};

// ============================================
// MongoDB $lookup Demo Page
// WHY: $lookup is MongoDB's JOIN — it merges data
//      from two collections into one result.
// HOW: Fetches /api/notices/with-authors which runs
//      an aggregation pipeline joining 'notices' +
//      'authors' on author name. Returns each notice
//      enriched with author_info.department & email.
// ============================================
const LookupDemoPage = () => {
    const [data, setData]       = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState(null);

    useEffect(() => {
            fetch(`${API_BASE}/api/notices/with-authors`)
            .then(res => res.json())
            .then(json => { setData(json); setLoading(false); })
            .catch(() => { setError('MongoDB not connected or $lookup failed.'); setLoading(false); });
    }, []);

    if (loading) return <div className="lookup-card"><p>⏳ Running MongoDB $lookup aggregation...</p></div>;
    if (error)   return <div className="lookup-card"><p style={{color:'red'}}>⚠️ {error}</p></div>;

    return (
        <div className="lookup-card">
            <div className="lookup-badge">🔗 MongoDB $lookup — Collection JOIN Demo</div>
            <h2 className="lookup-title">Notices + Authors (Joined)</h2>
            <p className="lookup-desc">
                The <code>/api/notices/with-authors</code> endpoint uses MongoDB's
                <strong> $lookup aggregation</strong> to JOIN the <em>notices</em> collection
                with the <em>authors</em> collection — like SQL's LEFT JOIN.
            </p>

            {/* Pipeline used */}
            <div className="lookup-pipeline">
                <span className="pipeline-step">notices</span>
                <span className="pipeline-arrow">→ $lookup →</span>
                <span className="pipeline-step">authors</span>
                <span className="pipeline-arrow">→ $addFields →</span>
                <span className="pipeline-step">result</span>
            </div>

            {/* Result Table */}
            <div className="lookup-table-wrap">
                <table className="lookup-table">
                    <thead>
                        <tr>
                            <th>📋 Title</th>
                            <th>🏷 Type</th>
                            <th>👤 Author</th>
                            <th>🏢 Department</th>
                            <th>📧 Email</th>
                            <th>📅 Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map(notice => (
                            <tr key={notice._id}>
                                <td className="lookup-title-cell">{notice.title}</td>
                                <td><span className="lookup-type-badge">{notice.type}</span></td>
                                <td>{notice.author}</td>
                                <td>
                                    {notice.author_info
                                        ? <span className="lookup-enriched">{notice.author_info.department}</span>
                                        : <span className="lookup-missing">No match</span>}
                                </td>
                                <td>
                                    {notice.author_info
                                        ? <span className="lookup-enriched">{notice.author_info.email}</span>
                                        : <span className="lookup-missing">—</span>}
                                </td>
                                <td>{new Date(notice.date).toLocaleDateString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <p className="lookup-note">
                🟢 Columns <strong>Department</strong> &amp; <strong>Email</strong> come from the
                <em> authors</em> collection — injected by <code>$lookup</code>.
                Rows without a matching author show "No match".
            </p>
        </div>
    );
};

// 6. Main App Component (React Router)
function App() {
    // using Custom Hook
    const { data: notices, loading, setData: setNotices } = useFetch('/api/notices');
    
    const handleAddNotice = (notice) => {
        setNotices(prev => [...prev, notice]);
    };

    return (
        <ThemeContext.Provider value={{ theme: 'light' }}>
            <BrowserRouter>
                <div className="app-container">
                    <nav className="nav-bar">
                        <h1>Separate React Hub</h1>
                        <div className="nav-links">
                            <Link to="/">All Notices</Link>
                            <Link to="/add">Add Notice</Link>
                            <Link to="/ejs-demo">EJS Demo</Link>
                            <Link to="/lookup">$lookup Demo</Link>
                        </div>
                    </nav>

                    <Routes>
                        <Route path="/" element={<HomePage notices={notices} setNotices={setNotices} loading={loading} />} />
                        <Route path="/add" element={<AddNoticePage onAdd={handleAddNotice} />} />
                        <Route path="/ejs-demo" element={<EjsDemoPage />} />
                        <Route path="/lookup" element={<LookupDemoPage />} />
                    </Routes>
                </div>
            </BrowserRouter>
        </ThemeContext.Provider>
    );
}

export default App;
