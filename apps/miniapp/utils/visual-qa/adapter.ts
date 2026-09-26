import { resetSessionState, setSessionState } from "../../store/session/index";
import { setPostImageUploadAdapter } from "../community-post-images-adapter";
import { setPublicContentAdapter } from "../public-content/adapter";
import { setSessionAuthAdapter } from "../session/adapter";
import { configureVisualQaMode, isVisualQaModeEnabled } from "./mode";
import {
  completeVisualQaCommunityPostImageUpload,
  createVisualQaCommunityComment,
  createVisualQaCommunityPost,
  createVisualQaMyCat,
  deleteVisualQaCommunityComment,
  deleteVisualQaCommunityPost,
  deleteVisualQaCommunityPostImage,
  deleteVisualQaMyCat,
  getVisualQaCat,
  getVisualQaCommunityPost,
  getVisualQaCommunityPostOptions,
  getVisualQaCurrentUser,
  getVisualQaFixedPage,
  getVisualQaMyCat,
  listVisualQaCats,
  listVisualQaCommunityPosts,
  listVisualQaMyCats,
  requestVisualQaCommunityPostImageUpload,
  submitVisualQaSelectionApplication,
  toggleVisualQaCommunityPostLike,
  updateVisualQaCommunityPost,
  updateVisualQaMyCat,
} from "./fixtures";

const VISUAL_QA_TOKEN = "visual-qa-token";
const VISUAL_QA_EXPIRES_AT = "2099-01-01T00:00:00.000Z";

export function configureVisualQaAdapter(query: Record<string, string | undefined> = {}) {
  configureVisualQaMode(query);

  if (!isVisualQaModeEnabled()) {
    setPublicContentAdapter(null);
    setSessionAuthAdapter(null);
    setPostImageUploadAdapter(null);
    return;
  }

  setPublicContentAdapter({
    completeCommunityPostImageUpload: completeVisualQaCommunityPostImageUpload,
    createCommunityComment: createVisualQaCommunityComment,
    createCommunityPost: createVisualQaCommunityPost,
    createMyCat: createVisualQaMyCat,
    deleteCommunityComment: deleteVisualQaCommunityComment,
    deleteCommunityPost: deleteVisualQaCommunityPost,
    deleteCommunityPostImage: deleteVisualQaCommunityPostImage,
    deleteMyCat: deleteVisualQaMyCat,
    getCommunityPost: getVisualQaCommunityPost,
    getCommunityPostOptions: getVisualQaCommunityPostOptions,
    getFixedPage: getVisualQaFixedPage,
    getMyCat: getVisualQaMyCat,
    getPublicCat: getVisualQaCat,
    listCommunityPosts: listVisualQaCommunityPosts,
    listMyCats: listVisualQaMyCats,
    listMyCommunityPosts: (params) => {
      const data = listVisualQaCommunityPosts();
      const pageSize = params?.pageSize ?? data.items.length;
      const items = data.items.slice(0, pageSize);
      return {
        items,
        pagination: {
          ...data.pagination,
          pageSize,
          total: items.length,
          totalPages: 1,
        },
      };
    },
    listPublicCats: listVisualQaCats,
    requestCommunityPostImageUpload: requestVisualQaCommunityPostImageUpload,
    submitSelectionApplication: submitVisualQaSelectionApplication,
    toggleCommunityPostLike: toggleVisualQaCommunityPostLike,
    updateCommunityPost: updateVisualQaCommunityPost,
    updateMyCat: updateVisualQaMyCat,
  });
  setSessionAuthAdapter({
    loginWithWechat: () => {
      const user = getVisualQaCurrentUser();
      applyVisualQaSession();
      return {
        token: VISUAL_QA_TOKEN,
        expiresAt: VISUAL_QA_EXPIRES_AT,
        user,
        verificationMode: "mock",
      };
    },
    logout: () => {
      resetSessionState();
    },
    refreshCurrentUser: () => {
      const user = getVisualQaCurrentUser();
      applyVisualQaSession();
      return user;
    },
  });
  setPostImageUploadAdapter({
    uploadPostImage: async (postId, image, sortOrder) => {
      const upload = await requestVisualQaCommunityPostImageUpload(postId, {
        fileName: image.fileName,
        mimeType: image.mimeType,
        sizeBytes: image.sizeBytes,
        usage: "gallery",
        sortOrder,
      });
      await completeVisualQaCommunityPostImageUpload(postId, upload.media.id);
    },
  });
}

function applyVisualQaSession() {
  const user = getVisualQaCurrentUser();
  setSessionState({
    token: VISUAL_QA_TOKEN,
    userId: user.id,
    currentRole: user.currentRole,
    roles: user.roles,
    user,
    expiresAt: VISUAL_QA_EXPIRES_AT,
  });
}
