import { Routes, Route, Navigate } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { HomePage } from "./routes/home/HomePage";
import { JoinPage } from "./routes/join/JoinPage";
import { ChatPage } from "./routes/chat/ChatPage";
import { ProjectorPage } from "./routes/projector/ProjectorPage";
import { AdminLoginPage } from "./routes/admin/login/AdminLoginPage";
import { AdminLayout } from "./routes/admin/AdminLayout";
import { EventsPage } from "./routes/admin/events/EventsPage";
import { ModerationPage } from "./routes/admin/moderation/ModerationPage";
import { PollsPage } from "./routes/admin/polls/PollsPage";
import { ExportPage } from "./routes/admin/export/ExportPage";
import { ParticipantsPage } from "./routes/admin/participants/ParticipantsPage";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route path="/join/:joinSlug" element={<JoinPage />} />
        <Route path="/chat/:joinSlug" element={<ChatPage />} />
        <Route path="/projector/:joinSlug" element={<ProjectorPage />} />

        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="events" replace />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="events/:eventId" element={<Navigate to="moderation" replace />} />
          <Route path="events/:eventId/moderation" element={<ModerationPage />} />
          <Route path="events/:eventId/polls" element={<PollsPage />} />
          <Route path="events/:eventId/participants" element={<ParticipantsPage />} />
          <Route path="events/:eventId/export" element={<ExportPage />} />
          <Route path="*" element={<Navigate to="/admin/events" replace />} />
        </Route>
      </Routes>
      <Analytics />
    </>
  );
}
