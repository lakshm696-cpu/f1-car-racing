/* 3ds Max reliably loads MAXScript package entries. The bootstrap then starts
   the Python receiver from the same package without depending on Max's install path. */
try
(
    local bootstrapDirectory = getFilenamePath (getSourceFileName())
    local pythonEntry = pathConfig.appendPath bootstrapDirectory "seele_receiver_startup.py"
    if doesFileExist pythonEntry then
    (
        python.ExecuteFile pythonEntry
        format "Seele Receiver bootstrap loaded: %\n" pythonEntry
    )
    else
    (
        format "Seele Receiver startup file is missing: %\n" pythonEntry
    )
)
catch
(
    format "Seele Receiver bootstrap failed: %\n" (getCurrentException())
)
