import { Routes, Route, Outlet } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { OwnerRedirect } from './components/OwnerRedirect';
import { RequiresActiveSubscription } from './components/RequiresActiveSubscription';

import EnterIntro from './pages/EnterIntro.jsx';
import Diagnose from './pages/Diagnose.jsx';
import Qualifier from './pages/Qualifier.jsx';
import Apply from './pages/Apply.jsx';
import HomeScreen from './pages/HomeScreen.jsx';
import Owner from './pages/Owner.jsx';
import ImageLab from './pages/owner/ImageLab.jsx';
import AgentLog from './pages/owner/AgentLog.jsx';
import Splash from './pages/Splash.jsx';
import Terms from './pages/legal/Terms.jsx';
import CoachingAgreement from './pages/legal/Coaching.jsx';
import Privacy from './pages/legal/Privacy.jsx';
import Import from './pages/client/Import.jsx';
import Onboarding from './pages/Onboarding.jsx';
import NotFound from './pages/NotFound.jsx';
import Migrate from './pages/Migrate.jsx';
import Login from './pages/auth/Login.jsx';
import Signup from './pages/auth/Signup.jsx';

import Dashboard from './pages/client/Dashboard.jsx';
import Workouts from './pages/client/Workouts.jsx';
import WorkoutGenerator from './pages/client/WorkoutGenerator.jsx';
import WorkoutBuilder from './pages/client/WorkoutBuilder.jsx';
import ExerciseHistory from './pages/client/ExerciseHistory.jsx';
import SessionDetail from './pages/client/SessionDetail.jsx';
import Meals from './pages/client/Meals.jsx';
import MealGenerator from './pages/client/MealGenerator.jsx';
import Habits from './pages/client/Habits.jsx';
import CalendarPage from './pages/client/Calendar.jsx';
import Profile from './pages/client/Profile.jsx';
import Assistant from './pages/client/Assistant.jsx';
import Billing from './pages/client/Billing.jsx';
import Settings from './pages/client/Settings.jsx';
import Reviews from './pages/client/Reviews.jsx';
import ReviewDetail from './pages/client/ReviewDetail.jsx';
import Inbox from './pages/client/Inbox.jsx';
import CoachInbox from './pages/coach/Inbox.jsx';
import CoachSessionDetail from './pages/coach/SessionDetail.jsx';

import CoachDashboard from './pages/coach/Dashboard.jsx';
import Clients from './pages/coach/Clients.jsx';
import ClientDetail from './pages/coach/ClientDetail.jsx';
import Programs from './pages/coach/Programs.jsx';
import Revenue from './pages/coach/Revenue.jsx';
import Announcements from './pages/coach/Announcements.jsx';
import AssistantLog from './pages/coach/AssistantLog.jsx';

// operatefitness.app redesign v3 — Trainerize-class mobile UI per locked mockups.
import OperateHome from './pages/operate/Home.jsx';
import OperateCalendar from './pages/operate/Calendar.jsx';
import OperateTraining from './pages/operate/Training.jsx';
import OperateNutrition from './pages/operate/Nutrition.jsx';
import OperateMessages from './pages/operate/Messages.jsx';
import OperateGoals from './pages/operate/Goals.jsx';
import OperateProfile from './pages/operate/Profile.jsx';
import OperateCoachInsights from './pages/operate/CoachInsights.jsx';

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<EnterIntro />} />
      <Route path="/splash" element={<Splash />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/migrate/:token" element={<Migrate />} />
      <Route path="/legal/terms" element={<Terms />} />
      <Route path="/legal/coaching" element={<CoachingAgreement />} />
      <Route path="/legal/privacy" element={<Privacy />} />

      {/* Public AI intake — replaces the paid ManyChat AI add-on. One
          component (Diagnose) drives all five keyword surfaces; it reads
          the path (or ?key=) to select the system-prompt framing. */}
      <Route path="/standard" element={<Diagnose />} />
      <Route path="/structure" element={<Diagnose />} />
      <Route path="/system" element={<Diagnose />} />
      <Route path="/protocol" element={<Diagnose />} />
      <Route path="/align" element={<Diagnose />} />
      <Route path="/diagnose" element={<Diagnose />} />
      {/* Native qualifier — replaces the external Typeform at
          pkfitelite.co.site. Public, anonymous, single-page intake. */}
      <Route path="/qualifier" element={<Qualifier />} />
      <Route path="/apply" element={<Apply />} />

      {/* iPhone-style home screen — outside the Layout chrome so it occupies
          the full viewport with its own dock. Still gated by auth + active
          subscription. */}
      <Route
        element={
          <ProtectedRoute role="client">
            <RequiresActiveSubscription />
          </ProtectedRoute>
        }
      >
        <Route path="/home" element={<HomeScreen />} />
      </Route>

      {/* Owner panel — only matters if the signed-in user's email is in
          OWNER_EMAILS server-side. The page itself enforces, so any client
          that sneaks here just sees the "Owner only" message. */}
      <Route
        path="/owner"
        element={
          <ProtectedRoute>
            <Owner />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner/images"
        element={
          <ProtectedRoute>
            <ImageLab />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner/agent-log"
        element={
          <ProtectedRoute>
            <AgentLog />
          </ProtectedRoute>
        }
      />

      {/* operatefitness.app v3 — full-bleed mobile screens (no Layout chrome). */}
      <Route
        element={
          <ProtectedRoute role="client">
            <RequiresActiveSubscription />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<OperateHome />} />
        <Route path="/calendar" element={<OperateCalendar />} />
        <Route path="/workouts/sessions/:id" element={<OperateTraining />} />
        <Route path="/meals" element={<OperateNutrition />} />
        <Route path="/inbox" element={<OperateMessages />} />
        <Route path="/habits" element={<OperateGoals />} />
        <Route path="/profile" element={<OwnerRedirect><OperateProfile /></OwnerRedirect>} />
      </Route>

      {/* Client-protected (legacy sidebar/dock chrome — for screens not yet
          reskinned in the v3 redesign). */}
      <Route
        element={
          <ProtectedRoute role="client">
            <RequiresActiveSubscription>
              <Layout />
            </RequiresActiveSubscription>
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard-legacy" element={<Dashboard />} />
        <Route path="/workouts" element={<Workouts />} />
        <Route path="/workouts/history" element={<ExerciseHistory />} />
        <Route path="/workouts/sessions-legacy/:id" element={<SessionDetail />} />
        <Route path="/workouts/generator" element={<WorkoutGenerator />} />
        <Route path="/workouts/builder" element={<WorkoutBuilder />} />
        <Route path="/meals-legacy" element={<Meals />} />
        <Route path="/meals/generator" element={<MealGenerator />} />
        <Route path="/habits-legacy" element={<Habits />} />
        <Route path="/calendar-legacy" element={<CalendarPage />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/reviews/:id" element={<ReviewDetail />} />
        <Route path="/inbox-legacy" element={<Inbox />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/profile-legacy" element={<OwnerRedirect><Profile /></OwnerRedirect>} />
        <Route path="/settings" element={<OwnerRedirect><Settings /></OwnerRedirect>} />
        <Route path="/import" element={<Import />} />
      </Route>

      {/* Coach v3 — operatefitness.app reskinned roster (full-bleed). */}
      <Route
        element={
          <ProtectedRoute role="coach">
            <Outlet />
          </ProtectedRoute>
        }
      >
        <Route path="/coach/clients" element={<OperateCoachInsights />} />
      </Route>

      {/* Coach-protected (legacy sidebar/dock chrome). */}
      <Route
        element={
          <ProtectedRoute role="coach">
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/coach" element={<CoachDashboard />} />
        <Route path="/coach/inbox" element={<CoachInbox />} />
        <Route path="/coach/clients-legacy" element={<Clients />} />
        <Route path="/coach/clients/:id" element={<ClientDetail />} />
        <Route path="/coach/clients/:id/sessions/:sid" element={<CoachSessionDetail />} />
        <Route path="/coach/programs" element={<Programs />} />
        <Route path="/coach/revenue" element={<Revenue />} />
        <Route path="/coach/announcements" element={<Announcements />} />
        <Route path="/coach/assistant-log" element={<AssistantLog />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
