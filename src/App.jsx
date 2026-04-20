import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

import Landing from './pages/Landing.jsx';
import Splash from './pages/Splash.jsx';
import Onboarding from './pages/Onboarding.jsx';
import NotFound from './pages/NotFound.jsx';
import Login from './pages/auth/Login.jsx';
import Signup from './pages/auth/Signup.jsx';

import Dashboard from './pages/client/Dashboard.jsx';
import Workouts from './pages/client/Workouts.jsx';
import WorkoutGenerator from './pages/client/WorkoutGenerator.jsx';
import WorkoutBuilder from './pages/client/WorkoutBuilder.jsx';
import Meals from './pages/client/Meals.jsx';
import MealGenerator from './pages/client/MealGenerator.jsx';
import Habits from './pages/client/Habits.jsx';
import CalendarPage from './pages/client/Calendar.jsx';
import Profile from './pages/client/Profile.jsx';
import Community from './pages/client/Community.jsx';
import Assistant from './pages/client/Assistant.jsx';
import Billing from './pages/client/Billing.jsx';
import Settings from './pages/client/Settings.jsx';
import Reviews from './pages/client/Reviews.jsx';
import ReviewDetail from './pages/client/ReviewDetail.jsx';
import Inbox from './pages/client/Inbox.jsx';
import CoachInbox from './pages/coach/Inbox.jsx';

import CoachDashboard from './pages/coach/Dashboard.jsx';
import Clients from './pages/coach/Clients.jsx';
import ClientDetail from './pages/coach/ClientDetail.jsx';
import Programs from './pages/coach/Programs.jsx';
import Revenue from './pages/coach/Revenue.jsx';
import Announcements from './pages/coach/Announcements.jsx';

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/splash" element={<Splash />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/onboarding" element={<Onboarding />} />

      {/* Client-protected */}
      <Route
        element={
          <ProtectedRoute role="client">
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/workouts" element={<Workouts />} />
        <Route path="/workouts/generator" element={<WorkoutGenerator />} />
        <Route path="/workouts/builder" element={<WorkoutBuilder />} />
        <Route path="/meals" element={<Meals />} />
        <Route path="/meals/generator" element={<MealGenerator />} />
        <Route path="/habits" element={<Habits />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/community" element={<Community />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/reviews/:id" element={<ReviewDetail />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      {/* Coach-protected */}
      <Route
        element={
          <ProtectedRoute role="coach">
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/coach" element={<CoachDashboard />} />
        <Route path="/coach/inbox" element={<CoachInbox />} />
        <Route path="/coach/clients" element={<Clients />} />
        <Route path="/coach/clients/:id" element={<ClientDetail />} />
        <Route path="/coach/programs" element={<Programs />} />
        <Route path="/coach/revenue" element={<Revenue />} />
        <Route path="/coach/announcements" element={<Announcements />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
