import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { AppDispatch, RootState } from "../app/store";
import { loggedOut } from "../features/auth/authSlice";

export default function NavBar() {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.auth.user);

  return (
    <nav className="border-b bg-white">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/workspaces" className="font-semibold text-gray-800">
          Collab Editor
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {user && <span className="text-gray-500">{user.name}</span>}
          <button
            onClick={() => dispatch(loggedOut())}
            className="text-gray-500 hover:text-gray-800"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
