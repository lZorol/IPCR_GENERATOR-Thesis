const { google } = require('googleapis');
const fs = require('fs');

class GoogleDriveService {
  constructor(tokens) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    if (tokens) {
      this.oauth2Client.setCredentials(tokens);
    }

    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Set "anyone with the link can view" permission on a file or folder.
   */
  async setPublicPermission(fileId) {
    try {
      await this.drive.permissions.create({
        fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });
    } catch (error) {
      console.warn('Could not set public permission:', error.message);
    }
  }

  // Global cache for folder IDs to prevent race conditions across multiple requests
  static folderPromises = new Map();

  /**
   * Find or create a folder by name under an optional parent.
   * This uses a static promise cache to ensure that concurrent requests for the same folder
   * wait for a single API operation instead of triggering multiple creates.
   */
  async findOrCreateFolder(folderName, parentId = null) {
    // Partition the cache by the user's access token to avoid permission issues 
    // when multiple users/accounts are active simultaneously.
    const userKey = this.oauth2Client.credentials.access_token 
      ? this.oauth2Client.credentials.access_token.substring(0, 16) 
      : 'public';
    const cacheKey = `${userKey}_${folderName}_${parentId || 'root'}`;
    
    if (GoogleDriveService.folderPromises.has(cacheKey)) {
      console.log(`📂 Folder already exists or creation in progress (cached): ${folderName}`);
      return GoogleDriveService.folderPromises.get(cacheKey);
    }

    const folderPromise = (async () => {
      try {
        const query = parentId
          ? `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
          : `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

        const response = await this.drive.files.list({
          q: query,
          fields: 'files(id, name, webViewLink)',
          spaces: 'drive'
        });

        let folder;
        if (response.data.files.length > 0) {
          folder = response.data.files[0];
        } else {
          console.log(`🆕 Creating new folder: ${folderName}`);
          const fileMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            ...(parentId && { parents: [parentId] })
          };

          const result = await this.drive.files.create({
            requestBody: fileMetadata,
            fields: 'id, name, webViewLink'
          });
          folder = result.data;

          // Make newly created folder publicly viewable via link
          await this.setPublicPermission(folder.id);
        }

        return folder;
      } catch (error) {
        // If creation fails, we must remove the promise from the cache so it can be retried
        GoogleDriveService.folderPromises.delete(cacheKey);
        throw error;
      }
    })();

    GoogleDriveService.folderPromises.set(cacheKey, folderPromise);
    return folderPromise;
  }

  /**
   * Upload a file to Google Drive.
   *
   * New folder hierarchy:
   *   IPCR / {academicYear} / {semester} / {facultyName} / {category} / file
   *
   * @param {string} filePath       - local path to the file
   * @param {string} fileName       - original filename
   * @param {string} category       - e.g. "Syllabus"
   * @param {string} [academicYear] - e.g. "2025-2026"
   * @param {string} [semester]     - e.g. "1st Semester"
   * @param {string} [facultyName]  - uploader's display name
   * @returns {{ fileId, fileName, webViewLink, webContentLink, folderPath, categoryFolderLinks }}
   */
  /**
   * Builds the base hierarchy: IPCR → year → semester → faculty.
   * Returns the faculty folder object.
   */
  async getOrCreateFacultyFolderHierarchy(academicYear, semester, facultyName) {
    const ipcrFolder    = await this.findOrCreateFolder('IPCR');
    const yearFolder    = await this.findOrCreateFolder(academicYear, ipcrFolder.id);
    const semFolder     = await this.findOrCreateFolder(semester, yearFolder.id);
    const facultyFolder = await this.findOrCreateFolder(facultyName, semFolder.id);
    return facultyFolder;
  }

  /**
   * Pre-creates/finds all category folders under a faculty folder.
   * Returns a map of category names to their webViewLinks.
   */
  async ensureCategoryFolders(facultyFolderId) {
    const categories = [
      'Syllabus', 'Course Guide', 'SLM', 'Grading Sheet', 'TOS',
      'Attendance Sheet', 'Class Record', 'Evaluation of Teaching Effectiveness',
      'Classroom Observation', 'Test Questions', 'Answer Keys',
      'Faculty and Students Seek Advices', 'Accomplishment Report',
      'R&D Proposal', 'Research Implemented', 'Research Presented',
      'Research Published', 'Intellectual Property Rights',
      'Research Utilized/Developed', 'Number of Citations',
      'Extension Proposal', 'Persons Trained', 'Person Service Rating',
      'Person Given Training', 'Technical Advice',
      'Accomplishment Report Support', 'Attendance Flag Ceremony',
      'Attendance Flag Lowering', 'Attendance Health and Wellness Program',
      'Attendance School Celebrations', 'Training/Seminar/Conference Certificate',
      'Attendance Faculty Meeting', 'Attendance ISO and Related Activities',
      'Attendance Spiritual Activities'
    ];

    const categoryFolderLinks = {};
    const categoryFolders = {};

    await Promise.all(categories.map(async (cat) => {
      const folder = await this.findOrCreateFolder(cat, facultyFolderId);
      const key = cat.replace(/\s+/g, '').toLowerCase();
      categoryFolderLinks[key] = folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`;
      categoryFolders[cat] = folder;
    }));

    return { categoryFolderLinks, categoryFolders };
  }

  /**
   * Upload a file to Google Drive.
   */
  async uploadFile(filePath, fileName, category, academicYear = '2025-2026', semester = '1st Semester', facultyName = 'Faculty', preCalculatedData = null) {
    try {
      let facultyFolder;
      let categoryFolders;
      let categoryFolderLinks;

      if (preCalculatedData) {
        facultyFolder = preCalculatedData.facultyFolder;
        categoryFolders = preCalculatedData.categoryFolders;
        categoryFolderLinks = preCalculatedData.categoryFolderLinks;
      } else {
        facultyFolder = await this.getOrCreateFacultyFolderHierarchy(academicYear, semester, facultyName);
        const ensureResult = await this.ensureCategoryFolders(facultyFolder.id);
        categoryFolders = ensureResult.categoryFolders;
        categoryFolderLinks = ensureResult.categoryFolderLinks;
      }

      // Find the specific category folder for this upload
      const targetCatFolder = categoryFolders[category] || await this.findOrCreateFolder(category, facultyFolder.id);

      // Upload file
      const fileMetadata = {
        name: fileName,
        parents: [targetCatFolder.id]
      };

      const media = {
        mimeType: 'application/pdf',
        body: fs.createReadStream(filePath)
      };

      const file = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink, webContentLink'
      });

      // Make the uploaded file publicly viewable via link
      await this.setPublicPermission(file.data.id);

      const folderPath = `IPCR/${academicYear}/${semester}/${facultyName}/${category}`;
      console.log(`✅ Uploaded to Google Drive: ${file.data.name}`);

      return {
        fileId: file.data.id,
        fileName: file.data.name,
        webViewLink: file.data.webViewLink,
        webContentLink: file.data.webContentLink,
        folderPath,
        categoryFolderLinks
      };
    } catch (error) {
      console.error('Error uploading to Google Drive:', error.message);
      throw error;
    }
  }

  /**
   * List files in a folder.
   */
  async listFiles(folderId) {
    try {
      const response = await this.drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, webViewLink, createdTime)',
        orderBy: 'createdTime desc'
      });

      return response.data.files;
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  }

  /**
   * Delete a file.
   */
  async deleteFile(fileId) {
    try {
      await this.drive.files.delete({ fileId });
      console.log(`🗑️ Deleted file: ${fileId}`);
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * Get file metadata.
   */
  async getFileMetadata(fileId) {
    try {
      const response = await this.drive.files.get({
        fileId,
        fields: 'id, name, mimeType, size, webViewLink, createdTime, modifiedTime'
      });

      return response.data;
    } catch (error) {
      console.error('Error getting file metadata:', error);
      throw error;
    }
  }
}

module.exports = GoogleDriveService;