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
   * Find or create a folder by name under an optional parent.
   */
  async findOrCreateFolder(folderName, parentId = null) {
    try {
      const query = parentId
        ? `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
        : `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, webViewLink)',
        spaces: 'drive'
      });

      if (response.data.files.length > 0) {
        return response.data.files[0];
      }

      // Create new folder
      const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentId && { parents: [parentId] })
      };

      const folder = await this.drive.files.create({
        requestBody: fileMetadata,
        fields: 'id, name, webViewLink'
      });

      return folder.data;
    } catch (error) {
      console.error('Error finding/creating folder:', error);
      throw error;
    }
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
   */
  async uploadFile(filePath, fileName, category, academicYear = '2025-2026', semester = '1st Semester', facultyName = 'Faculty') {
    try {
      // Build hierarchy: IPCR → year → semester → faculty → category
      const ipcrFolder    = await this.findOrCreateFolder('IPCR');
      const yearFolder    = await this.findOrCreateFolder(academicYear, ipcrFolder.id);
      const semFolder     = await this.findOrCreateFolder(semester, yearFolder.id);
      const facultyFolder = await this.findOrCreateFolder(facultyName, semFolder.id);
      const catFolder     = await this.findOrCreateFolder(category, facultyFolder.id);

      // Upload file
      const fileMetadata = {
        name: fileName,
        parents: [catFolder.id]
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

      const folderPath = `IPCR/${academicYear}/${semester}/${facultyName}/${category}`;
      console.log(`✅ Uploaded to Google Drive: ${file.data.name}`);
      console.log(`   Path: ${folderPath}`);
      console.log(`   Link: ${file.data.webViewLink}`);

      return {
        fileId: file.data.id,
        fileName: file.data.name,
        webViewLink: file.data.webViewLink,
        webContentLink: file.data.webContentLink,
        folderPath
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