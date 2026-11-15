/* Installed into each 3ds Max user profile's scripts/startup directory.
   This is the reliable auto-start entry for script-based packages. */
try
(
    local environmentClass = dotNetClass "System.Environment"
    local programData = environmentClass.GetEnvironmentVariable("PROGRAMDATA")
    local bundleEntry = programData + "\\Autodesk\\ApplicationPlugins\\SeeleReceiver.bundle\\Contents\\scripts\\startup\\seele_receiver_bootstrap.ms"
    if doesFileExist bundleEntry then
    (
        fileIn bundleEntry
    )
    else
    (
        format "Seele Receiver bundle entry is missing: %\n" bundleEntry
    )
)
catch
(
    format "Seele Receiver startup loader failed: %\n" (getCurrentException())
)
